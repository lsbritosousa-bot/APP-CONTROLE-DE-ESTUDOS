import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (e: string, p: string) => Promise<any>;
  signUp: (e: string, p: string, name: string) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
      
      if (error && error.code === 'PGRST116') {
        const newProfile = {
          id: user.id,
          display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Novo Recruta',
          email: user.email || '',
          xp: 0,
          level: 1,
          total_study_time: 0,
          daily_goal_minutes: 240,
        };
        const { data: inserted } = await supabase.from('user_profiles').insert(newProfile).select().single();
        if (inserted) {
          setProfile({
            uid: inserted.id,
            displayName: inserted.display_name,
            email: inserted.email,
            xp: inserted.xp,
            level: inserted.level,
            totalStudyTime: inserted.total_study_time,
            dailyGoalMinutes: inserted.daily_goal_minutes,
            createdAt: inserted.created_at
          } as any);
        }
      } else if (data) {
        setProfile({
          uid: data.id,
          displayName: data.display_name,
          email: data.email,
          xp: data.xp,
          level: data.level,
          totalStudyTime: data.total_study_time,
          dailyGoalMinutes: data.daily_goal_minutes,
          createdAt: data.created_at
        } as any);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, name: string) => {
    return await supabase.auth.signUp({ 
      email, 
      password,
      options: { data: { full_name: name } }
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
