import { create } from 'zustand';

export interface FoodItem {
  id: number;
  nutritionix_id?: string;
  name: string;
  brand?: string;
  serving_qty: number;
  serving_unit: string;
  serving_weight_grams?: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  is_custom?: boolean;
}

export interface FoodLogEntry {
  id: number;
  food_item_id: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  logged_date: string;
  servings: number;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  food_item: FoodItem;
}

export interface MealGroup {
  entries: FoodLogEntry[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

interface FoodLogState {
  selectedDate: string;
  entries: Record<string, MealGroup>;
  isLoading: boolean;
  setDate: (date: string) => void;
  setEntries: (entries: Record<string, MealGroup>) => void;
  setLoading: (loading: boolean) => void;
}

const today = () => new Date().toISOString().split('T')[0];

export const useFoodLogStore = create<FoodLogState>((set) => ({
  selectedDate: today(),
  entries: {},
  isLoading: false,
  setDate: (date) => set({ selectedDate: date }),
  setEntries: (entries) => set({ entries }),
  setLoading: (isLoading) => set({ isLoading }),
}));
