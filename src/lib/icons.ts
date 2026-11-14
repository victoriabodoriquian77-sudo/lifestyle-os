import {
  BedDouble, Bike, BookOpen, Brain, Coffee, Compass, Droplets, Dumbbell, Flame, Footprints,
  GraduationCap, Heart, Home, Leaf, Laptop, Moon, Music, PenLine, Salad, Sparkles, Sun,
  Target, Timer, Wallet, Wind, Apple, Bath, NotebookPen, Circle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const HABIT_ICONS: Record<string, LucideIcon> = {
  Droplets, Dumbbell, Footprints, BookOpen, Sun, Moon, Sparkles, GraduationCap, BedDouble,
  Compass, Salad, Heart, Brain, Coffee, Music, Laptop, Wallet, Home, Bike, Wind, Flame,
  Leaf, PenLine, Timer, Target, Apple, Bath, NotebookPen, Circle,
};

export const HABIT_ICON_NAMES = Object.keys(HABIT_ICONS);

export const habitIcon = (name: string): LucideIcon => HABIT_ICONS[name] ?? Circle;

export const HABIT_COLORS = [
  'var(--accent)', '#8FB3E0', '#E0B47C', '#D79BB0', '#A3D1B5', '#C3B1E1', '#E0D08F', '#9FD3D0',
];

export const PROJECT_COLORS = ['var(--accent)', '#8FB3E0', '#E0B47C', '#D79BB0', '#A3D1B5', '#C3B1E1'];
