import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateBMR(gender: string, weightKg: number, heightCm: number, ageYears: number): number {
  if (gender === 'female') {
    return 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * ageYears);
  }
  return 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * ageYears);
}

const activityMultipliers: Record<string, number> = {
  sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55,
  very_active: 1.725, extra_active: 1.9,
};

const goalAdjustments: Record<string, number> = {
  lose_weight: -500, maintain_weight: 0, gain_muscle: 300,
  improve_fitness: 0, eat_healthier: 0,
};

export function calculateDailyCalories(params: {
  gender: string; weightKg: number; heightCm: number;
  ageYears: number; activityLevel: string; primaryGoal: string;
}): number {
  const bmr  = calculateBMR(params.gender, params.weightKg, params.heightCm, params.ageYears);
  const tdee = bmr * (activityMultipliers[params.activityLevel] ?? 1.2);
  const adj  = goalAdjustments[params.primaryGoal] ?? 0;
  return Math.max(1200, Math.round(tdee + adj));
}

export function calculateMacros(calories: number) {
  return {
    protein_g: Math.round((calories * 0.30) / 4),
    carbs_g:   Math.round((calories * 0.40) / 4),
    fat_g:     Math.round((calories * 0.30) / 9),
  };
}

export function getAgeFromDOB(dob: string): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}
