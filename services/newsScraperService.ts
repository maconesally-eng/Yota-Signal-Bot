// News Scraper Service for Crypto News Aggregation
// Uses free public APIs and RSS feeds - no API keys required

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  relevantPairs: string[];
}

export interface MarketContext {
  overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentimentScore: number; // -100 to 100
  topNews: NewsItem[];
  lastUpdated: number;
}

// Sentiment keywords for analysis
const BULLISH_KEYWORDS = [
  'surge', 'soar', 'rally', 'bullish', 'breakout', 'ath', 'all-time high',
  'buy', 'moon', 'pump', 'gains', 'higher', 'upside', 'accumulate',
  'institutional', 'adoption', 'approval', 'partnership', 'upgrade'
];

const BEARISH_KEYWORDS = [
  'crash', 'dump', 'drop', 'bearish', 'breakdown', 'sell', 'plunge',
  'decline', 'lower', 'downside', 'fear', 'hack', 'scam', 'fraud',
  'regulation', 'ban', 'lawsuit', 'sec', 'investigation', 'warning'
];

// Pair detection patterns
const PAIR_PATTERNS: Record<string, RegExp> = {
  'BTC': /bitcoin|btc|₿/i,
  'ETH': /ethereum|eth|ether/i,
  'SOL': /solana|sol/i,
  'AVAX': /avalanche|avax/i,
  'MATIC': /polygon|matic/i,
  'DOT': /polkadot|dot/i,
  'LINK': /chainlink|link/i,
  'XRP': /ripple|xrp/i,
};

class NewsScraperService {
  private cache: MarketContext | null = null;
  private cacheExpiry: number = 0;
  private cacheDuration: number = 5 * 60 * 1000; // 5 minutes
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Auto-refresh news every 5 minutes
    setInterval(() => this.fetchNews(), this.cacheDuration);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  // Get cached market context or fetch fresh
  async getMarketContext(): Promise<MarketContext> {
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache;
    }
    return this.fetchNews();
  }

  // Fetch news from multiple sources
  async fetchNews(): Promise<MarketContext> {
    const news: NewsItem[] = [];

    // Try multiple sources in parallel
    const sources = await Promise.allSettled([
      this.fetchFromCryptoPanicRSS(),
      this.fetchFromCoinDeskRSS(),
      this.fetchMockNews(), // Fallback mock data
    ]);

    // Collect successful results
    for (const result of sources) {
      if (result.status === 'fulfilled') {
        news.push(...result.value);
      }
    }

    // Dedupe by title similarity
    const uniqueNews = this.dedupeNews(news);

    // Sort by timestamp
    uniqueNews.sort((a, b) => b.publishedAt - a.publishedAt);

    // Calculate overall sentiment
    const context = this.calculateMarketContext(uniqueNews.slice(0, 20));

    // Cache result
    this.cache = context;
    this.cacheExpiry = Date.now() + this.cacheDuration;
    this.notify();

    return context;
  }

  // Fetch from CryptoPanic RSS (public, no API key)
  private async fetchFromCryptoPanicRSS(): Promise<NewsItem[]> {
    try {
      // CryptoPanic provides a public RSS feed
      const response = await fetch('https://cryptopanic.com/news/rss/', {
        mode: 'cors',
        headers: { 'Accept': 'application/rss+xml' }
      });

      if (!response.ok) throw new Error('CryptoPanic RSS failed');

      const text = await response.text();
      return this.parseRSSFeed(text, 'CryptoPanic');
    } catch (error) {
      console.warn('NewsScraperService: CryptoPanic fetch failed', error);
      return [];
    }
  }

  // Fetch from CoinDesk RSS
  private async fetchFromCoinDeskRSS(): Promise<NewsItem[]> {
    try {
      const response = await fetch('https://www.coindesk.com/arc/outboundfeeds/rss/', {
        mode: 'cors',
        headers: { 'Accept': 'application/rss+xml' }
      });

      if (!response.ok) throw new Error('CoinDesk RSS failed');

      const text = await response.text();
      return this.parseRSSFeed(text, 'CoinDesk');
    } catch (error) {
      console.warn('NewsScraperService: CoinDesk fetch failed', error);
      return [];
    }
  }

  // Parse RSS feed XML
  private parseRSSFeed(xml: string, source: string): NewsItem[] {
    const items: NewsItem[] = [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const entries = doc.querySelectorAll('item');

      entries.forEach((entry, index) => {
        if (index >= 15) return; // Limit to 15 items per source

        const title = entry.querySelector('title')?.textContent || '';
        const description = entry.querySelector('description')?.textContent || '';
        const link = entry.querySelector('link')?.textContent || '';
        const pubDate = entry.querySelector('pubDate')?.textContent || '';

        // Clean HTML from description
        const summary = description.replace(/<[^>]*>/g, '').slice(0, 200);

        const newsItem: NewsItem = {
          id: `${source}-${Date.now()}-${index}`,
          title,
          summary,
          source,
          url: link,
          publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
          sentiment: this.analyzeSentiment(title + ' ' + summary),
          relevantPairs: this.detectPairs(title + ' ' + summary),
        };

        items.push(newsItem);
      });
    } catch (error) {
      console.warn('NewsScraperService: RSS parse error', error);
    }

    return items;
  }

  // Fallback mock news for development/offline
  private async fetchMockNews(): Promise<NewsItem[]> {
    const now = Date.now();
    return [
      {
        id: 'mock-1',
        title: 'Bitcoin Holds Strong Above $65K Amid Market Consolidation',
        summary: 'Bitcoin continues to trade in a tight range as traders await the next catalyst.',
        source: 'Mock News',
        url: '#',
        publishedAt: now - 3600000,
        sentiment: 'NEUTRAL',
        relevantPairs: ['BTC'],
      },
      {
        id: 'mock-2',
        title: 'Solana Network Sees Record Transaction Volume',
        summary: 'The Solana blockchain processed over 50 million transactions in the past 24 hours.',
        source: 'Mock News',
        url: '#',
        publishedAt: now - 7200000,
        sentiment: 'BULLISH',
        relevantPairs: ['SOL'],
      },
      {
        id: 'mock-3',
        title: 'Ethereum ETF Speculation Grows as Deadline Approaches',
        summary: 'Market participants anticipate potential SEC decision on Ethereum ETF applications.',
        source: 'Mock News',
        url: '#',
        publishedAt: now - 10800000,
        sentiment: 'BULLISH',
        relevantPairs: ['ETH'],
      },
    ];
  }

  // Analyze sentiment from text
  private analyzeSentiment(text: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const lowerText = text.toLowerCase();

    let bullishScore = 0;
    let bearishScore = 0;

    for (const keyword of BULLISH_KEYWORDS) {
      if (lowerText.includes(keyword)) bullishScore++;
    }

    for (const keyword of BEARISH_KEYWORDS) {
      if (lowerText.includes(keyword)) bearishScore++;
    }

    if (bullishScore > bearishScore + 1) return 'BULLISH';
    if (bearishScore > bullishScore + 1) return 'BEARISH';
    return 'NEUTRAL';
  }

  // Detect relevant trading pairs from text
  private detectPairs(text: string): string[] {
    const pairs: string[] = [];

    for (const [pair, pattern] of Object.entries(PAIR_PATTERNS)) {
      if (pattern.test(text)) {
        pairs.push(pair);
      }
    }

    return pairs;
  }

  // Remove duplicate news items
  private dedupeNews(news: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    return news.filter(item => {
      const key = item.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Calculate overall market context
  private calculateMarketContext(news: NewsItem[]): MarketContext {
    if (news.length === 0) {
      return {
        overallSentiment: 'NEUTRAL',
        sentimentScore: 0,
        topNews: [],
        lastUpdated: Date.now(),
      };
    }

    // Weight more recent news higher
    let score = 0;
    const now = Date.now();

    for (const item of news) {
      const age = (now - item.publishedAt) / 3600000; // Hours old
      const weight = Math.max(0.1, 1 - age / 24); // Decay over 24 hours

      if (item.sentiment === 'BULLISH') score += weight;
      else if (item.sentiment === 'BEARISH') score -= weight;
    }

    // Normalize to -100 to 100
    const normalizedScore = Math.max(-100, Math.min(100, (score / news.length) * 100));

    let overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (normalizedScore > 20) overallSentiment = 'BULLISH';
    else if (normalizedScore < -20) overallSentiment = 'BEARISH';
    else overallSentiment = 'NEUTRAL';

    return {
      overallSentiment,
      sentimentScore: Math.round(normalizedScore),
      topNews: news.slice(0, 10),
      lastUpdated: Date.now(),
    };
  }

  // Get news for a specific pair
  getNewsForPair(pair: string): NewsItem[] {
    if (!this.cache) return [];

    const basePair = pair.replace('-PERP', '').replace('/USDT', '');
    return this.cache.topNews.filter(item =>
      item.relevantPairs.includes(basePair)
    );
  }

  // Get sentiment for a specific pair
  getSentimentForPair(pair: string): { sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; score: number } {
    const pairNews = this.getNewsForPair(pair);

    if (pairNews.length === 0) {
      return { sentiment: 'NEUTRAL', score: 0 };
    }

    let score = 0;
    for (const item of pairNews) {
      if (item.sentiment === 'BULLISH') score++;
      else if (item.sentiment === 'BEARISH') score--;
    }

    const normalizedScore = (score / pairNews.length) * 100;

    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (normalizedScore > 30) sentiment = 'BULLISH';
    else if (normalizedScore < -30) sentiment = 'BEARISH';
    else sentiment = 'NEUTRAL';

    return { sentiment, score: Math.round(normalizedScore) };
  }
}

// Singleton export
export const newsScraperService = new NewsScraperService();
