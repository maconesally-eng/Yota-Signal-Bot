import { AgentMemory, AgentLesson } from '../types';

const MEMORY_KEY = 'yota_agent_memory_v1';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DEFAULT_MEMORY: AgentMemory = {
  level: 1,
  currentXp: 0,
  nextLevelXp: 100,
  brainVersion: 'v1.0',
  lessons: [
    {
      id: 'init-1',
      timestamp: Date.now(),
      trendContext: 'CHOPPY',
      insight: 'Initial Protocol: I must confirm volume displacement before entering any trade to avoid fake-outs.'
    }
  ]
};

type MemoryListener = (memory: AgentMemory) => void;

class MemoryService {
  private listeners: Set<MemoryListener> = new Set();
  private syncInProgress: boolean = false;
  private lastSyncTime: number = 0;
  private syncInterval: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Auto-sync with cloud every 5 minutes
    setInterval(() => this.syncToCloud(), this.syncInterval);

    // Sync on page visibility change (when user returns to tab)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncFromCloud();
        }
      });
    }
  }

  // Subscribe to memory changes
  subscribe(listener: MemoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(memory: AgentMemory): void {
    this.listeners.forEach(l => l(memory));
  }

  getMemory(): AgentMemory {
    const stored = localStorage.getItem(MEMORY_KEY);
    if (!stored) return DEFAULT_MEMORY;
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Memory corruption detected, resetting agent.", e);
      return DEFAULT_MEMORY;
    }
  }

  saveMemory(memory: AgentMemory): void {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
    this.notify(memory);
  }

  addExperience(amount: number): { memory: AgentMemory, leveledUp: boolean } {
    const memory = this.getMemory();
    memory.currentXp += amount;

    let leveledUp = false;
    // Level Up Logic
    if (memory.currentXp >= memory.nextLevelXp) {
      memory.level += 1;
      memory.currentXp = memory.currentXp - memory.nextLevelXp;
      memory.nextLevelXp = Math.floor(memory.nextLevelXp * 1.5); // Harder to level up each time

      // Update Version String
      const major = Math.floor(memory.level / 10) + 1;
      const minor = memory.level % 10;
      memory.brainVersion = `v${major}.${minor}`;
      leveledUp = true;
    }

    this.saveMemory(memory);

    // Trigger cloud sync after level up
    if (leveledUp) {
      this.syncToCloud();
    }

    return { memory, leveledUp };
  }

  addLesson(insight: string, trendContext: 'UP' | 'DOWN' | 'CHOPPY'): AgentMemory {
    const memory = this.getMemory();

    const newLesson: AgentLesson = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      trendContext,
      insight
    };

    // Keep only last 50 lessons to prevent overflow, but keep the first one (origin story)
    if (memory.lessons.length > 50) {
      memory.lessons = [memory.lessons[0], ...memory.lessons.slice(-49), newLesson];
    } else {
      memory.lessons.push(newLesson);
    }

    this.saveMemory(memory);
    return memory;
  }

  // ==========================================================================
  // Cloud Sync Methods
  // ==========================================================================

  async syncToCloud(): Promise<boolean> {
    if (this.syncInProgress) {
      console.log('MemoryService: Sync already in progress');
      return false;
    }

    this.syncInProgress = true;

    try {
      const memory = this.getMemory();

      const response = await fetch(`${API_BASE}/api/memory/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memory }),
      });

      if (!response.ok) {
        throw new Error('Cloud sync failed');
      }

      const data = await response.json();

      // Merge cloud data with local (cloud has higher priority for conflicts)
      if (data.memory) {
        const merged = this.mergeMemory(memory, data.memory);
        this.saveMemory(merged);
      }

      this.lastSyncTime = Date.now();
      console.log('MemoryService: Synced to cloud successfully');
      return true;

    } catch (error) {
      console.warn('MemoryService: Cloud sync failed', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncFromCloud(): Promise<boolean> {
    if (this.syncInProgress) {
      return false;
    }

    // Don't sync too frequently
    if (Date.now() - this.lastSyncTime < 60000) {
      return false;
    }

    this.syncInProgress = true;

    try {
      const response = await fetch(`${API_BASE}/api/memory`);

      if (!response.ok) {
        throw new Error('Failed to fetch cloud memory');
      }

      const data = await response.json();

      if (data.memory) {
        const localMemory = this.getMemory();
        const merged = this.mergeMemory(localMemory, data.memory);
        this.saveMemory(merged);
      }

      this.lastSyncTime = Date.now();
      console.log('MemoryService: Synced from cloud successfully');
      return true;

    } catch (error) {
      console.warn('MemoryService: Cloud fetch failed', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  private mergeMemory(local: AgentMemory, cloud: AgentMemory): AgentMemory {
    // Keep higher level
    const level = Math.max(local.level, cloud.level);

    // Use XP from whichever has higher level, or local if same
    const useLocalXp = local.level >= cloud.level;
    const currentXp = useLocalXp ? local.currentXp : cloud.currentXp;
    const nextLevelXp = useLocalXp ? local.nextLevelXp : cloud.nextLevelXp;

    // Version from higher level
    const brainVersion = local.level >= cloud.level ? local.brainVersion : cloud.brainVersion;

    // Merge lessons (dedupe by id, keep unique from both)
    const lessonMap = new Map<string, AgentLesson>();

    // Add local lessons first
    for (const lesson of local.lessons) {
      lessonMap.set(lesson.id, lesson);
    }

    // Add cloud lessons (will overwrite if same id)
    for (const lesson of cloud.lessons) {
      lessonMap.set(lesson.id, lesson);
    }

    // Sort by timestamp and keep last 50
    const allLessons = Array.from(lessonMap.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    // Keep first lesson (origin) and last 49
    const lessons = allLessons.length > 50
      ? [allLessons[0], ...allLessons.slice(-49)]
      : allLessons;

    return {
      level,
      currentXp,
      nextLevelXp,
      brainVersion,
      lessons,
    };
  }

  // Force immediate sync (useful after important events)
  async forceSync(): Promise<boolean> {
    this.lastSyncTime = 0; // Reset cooldown
    const cloudSynced = await this.syncToCloud();
    return cloudSynced;
  }

  // Get sync status
  getSyncStatus(): { lastSync: number; inProgress: boolean } {
    return {
      lastSync: this.lastSyncTime,
      inProgress: this.syncInProgress,
    };
  }

  // Reset memory to default
  resetMemory(): AgentMemory {
    this.saveMemory(DEFAULT_MEMORY);
    return DEFAULT_MEMORY;
  }
}

// Singleton export
export const memoryService = new MemoryService();
