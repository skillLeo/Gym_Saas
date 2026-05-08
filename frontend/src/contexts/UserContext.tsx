'use client';

import React, { createContext, useContext, useState } from 'react';

export type UserRole = 'member' | 'admin';

export interface MockUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  coverPhoto: string;
  bio: string;
  role: UserRole;
  trialDaysLeft: number;
  isSubscribed: boolean;
  fitnessGoal: string;
  currentWeight: number;
  targetWeight: number;
  height: number;
  age: number;
  followers: number;
  following: number;
  friends: number;
}

const defaultUser: MockUser = {
  id: '1',
  name: 'Kelvin Silas',
  username: 'kelvinsilas',
  email: 'kelvin@goteamextreme.com',
  avatar: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=150&h=150&fit=crop&crop=face',
  coverPhoto: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=400&fit=crop',
  bio: 'Fitness coach & founder of Team Extreme. Helping people transform their lives through fitness.',
  role: 'member',
  trialDaysLeft: 16,
  isSubscribed: false,
  fitnessGoal: 'Build Muscle',
  currentWeight: 185,
  targetWeight: 175,
  height: 72,
  age: 38,
  followers: 342,
  following: 128,
  friends: 87,
};

interface UserContextValue {
  user: MockUser;
  role: UserRole;
  setRole: (r: UserRole) => void;
  isLoggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
}

const UserContext = createContext<UserContextValue>({
  user: defaultUser,
  role: 'member',
  setRole: () => {},
  isLoggedIn: true,
  setLoggedIn: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>('member');
  const [isLoggedIn, setLoggedIn] = useState(true);

  return (
    <UserContext.Provider value={{ user: { ...defaultUser, role }, role, setRole, isLoggedIn, setLoggedIn }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
