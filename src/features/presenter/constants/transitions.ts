import {
    Play,
    RotateCcw,
    Box,
    Layers,
    MonitorPlay,
    Film,
    Move,
    Sparkles,
    Wand2,
    LucideIcon
} from 'lucide-react';

export interface ITransitionDefinition {
    id: string;
    name: string;
    category: string;
    desc: string;
    icon?: LucideIcon;
}

export const TRANSITION_CATEGORIES = [
    { id: 'Fades & Blurs', name: 'Fades & Blurs', icon: Sparkles },
    { id: 'Cinematic Masks', name: 'Cinematic Masks', icon: Film },
    { id: 'Geometric Wipes', name: 'Geometric Wipes', icon: Box },
    { id: 'Slide & Push', name: 'Slide & Push', icon: Move },
    { id: 'Motion & Scales', name: 'Motion & Scales', icon: MonitorPlay },
];

export const TRANSITIONS: ITransitionDefinition[] = [
    // Fades & Blurs
    { id: 'fade', name: 'Fade', category: 'Fades & Blurs', desc: 'Мягкое растворение' },
    { id: 'blur', name: 'Blur Fade', category: 'Fades & Blurs', desc: 'Размытие по Гауссу' },

    // Cinematic / Mask Effects
    { id: 'burn', name: 'Film Burn', category: 'Cinematic Masks', desc: 'Пересвет и выгорание пленки' },
    { id: 'comic-dots', name: 'Comic Dots', category: 'Cinematic Masks', desc: 'Аморфное увеличение кругов' },
    { id: 'checkerboard', name: '3D Checkerboard', category: 'Cinematic Masks', desc: '3D переворот плиток' },
    { id: 'iris', name: 'Iris Reveal', category: 'Cinematic Masks', desc: 'Раскрытие диафрагмы' },

    // Geometric Wipes
    { id: 'glitch', name: 'Digital Glitch', category: 'Geometric Wipes', desc: 'Сдвиг пикселей и помехи' },
    { id: 'curtain-split', name: 'Vertical Split', category: 'Geometric Wipes', desc: 'Разрез шторок' },
    { id: 'angled-wipe', name: 'Angled Wipe', category: 'Geometric Wipes', desc: 'Диагональное стирание' },
    { id: 'venetian-blinds', name: 'Venetian Blinds', category: 'Geometric Wipes', desc: 'Жалюзи' },
    { id: 'diamond', name: 'Diamond Wipe', category: 'Geometric Wipes', desc: 'Ромбовидный переход' },

    // Slides & Pushes
    { id: 'slide', name: 'Slide', category: 'Slide & Push', desc: 'Классическое скольжение' },
    { id: 'push', name: 'Push', category: 'Slide & Push', desc: 'Вытеснение' },

    // Zooms & Pans
    { id: 'zoom', name: 'Zoom', category: 'Motion & Scales', desc: 'Масштабирование' },
    { id: 'pan', name: 'Pan', category: 'Motion & Scales', desc: 'Панорамный сдвиг' },
];
