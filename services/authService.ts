// Mock User Data
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: 'FREE' | 'PRO';
}

const MOCK_USER: User = {
  id: 'u1',
  name: 'Alex Trader',
  email: 'alex@yota.app',
  plan: 'PRO',
};

export const authService = {
  login: async (email: string, password?: string): Promise<User> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email) {
          localStorage.setItem('yota_user', JSON.stringify(MOCK_USER));
          resolve(MOCK_USER);
        } else {
          reject(new Error('Invalid credentials'));
        }
      }, 1000);
    });
  },

  register: async (email: string, password?: string): Promise<User> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newUser = { ...MOCK_USER, email, name: email.split('@')[0] };
        localStorage.setItem('yota_user', JSON.stringify(newUser));
        resolve(newUser);
      }, 1000);
    });
  },

  loginWithGoogle: async (): Promise<User> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        localStorage.setItem('yota_user', JSON.stringify(MOCK_USER));
        resolve(MOCK_USER);
      }, 1500); // Simulate popup delay
    });
  },

  sendMagicLink: async (email: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Magic link sent to ${email}`);
        resolve(true);
      }, 1000);
    });
  },

  logout: async (): Promise<void> => {
    return new Promise((resolve) => {
      localStorage.removeItem('yota_user');
      resolve();
    });
  },

  getCurrentUser: (): User | null => {
    const userStr = localStorage.getItem('yota_user');
    return userStr ? JSON.parse(userStr) : null;
  }
};
