import logoBlack from '@/assets/logos/sda/adventist-symbol-tm-circle--black.svg';
import logoBluejay from '@/assets/logos/sda/adventist-symbol-tm-circle--bluejay.svg';
import logoCampfire from '@/assets/logos/sda/adventist-symbol-tm-circle--campfire.svg';
import logoCave from '@/assets/logos/sda/adventist-symbol-tm-circle--cave.svg';
import logoDenim from '@/assets/logos/sda/adventist-symbol-tm-circle--denim.svg';
import logoEarth from '@/assets/logos/sda/adventist-symbol-tm-circle--earth.svg';
import logoEmperor from '@/assets/logos/sda/adventist-symbol-tm-circle--emperor.svg';
import logoForest from '@/assets/logos/sda/adventist-symbol-tm-circle--forest.svg';
import logoGrapevine from '@/assets/logos/sda/adventist-symbol-tm-circle--grapevine.svg';
import logoIris from '@/assets/logos/sda/adventist-symbol-tm-circle--iris.svg';
import logoLily from '@/assets/logos/sda/adventist-symbol-tm-circle--lily.svg';
import logoMing from '@/assets/logos/sda/adventist-symbol-tm-circle--ming.svg';
import logoNight from '@/assets/logos/sda/adventist-symbol-tm-circle--night.svg';
import logoScarlett from '@/assets/logos/sda/adventist-symbol-tm-circle--scarlett.svg';
import logoTreefrog from '@/assets/logos/sda/adventist-symbol-tm-circle--treefrog.svg';
import logoVelvet from '@/assets/logos/sda/adventist-symbol-tm-circle--velvet.svg';
import logoWhite from '@/assets/logos/sda/adventist-symbol-tm-circle--white.svg';
import logoWinter from '@/assets/logos/sda/adventist-symbol-tm-circle--winter.svg';

import { ILogoGroup } from '../types';

/**
 * PRELOADED_LOGOS defines the built-in logo collections that are bundled with the app.
 */
export const PRELOADED_LOGOS: ILogoGroup[] = [
    {
        id: 'group-sda',
        name: 'SDA Logos',
        nameRu: 'Логотипы АСД',
        logos: [
            { id: 'sda-black', name: 'Black', url: logoBlack, isPreloaded: true },
            { id: 'sda-bluejay', name: 'Bluejay', url: logoBluejay, isPreloaded: true },
            { id: 'sda-campfire', name: 'Campfire', url: logoCampfire, isPreloaded: true },
            { id: 'sda-cave', name: 'Cave', url: logoCave, isPreloaded: true },
            { id: 'sda-denim', name: 'Denim', url: logoDenim, isPreloaded: true },
            { id: 'sda-earth', name: 'Earth', url: logoEarth, isPreloaded: true },
            { id: 'sda-emperor', name: 'Emperor', url: logoEmperor, isPreloaded: true },
            { id: 'sda-forest', name: 'Forest', url: logoForest, isPreloaded: true },
            { id: 'sda-grapevine', name: 'Grapevine', url: logoGrapevine, isPreloaded: true },
            { id: 'sda-iris', name: 'Iris', url: logoIris, isPreloaded: true },
            { id: 'sda-lily', name: 'Lily', url: logoLily, isPreloaded: true },
            { id: 'sda-ming', name: 'Ming', url: logoMing, isPreloaded: true },
            { id: 'sda-night', name: 'Night', url: logoNight, isPreloaded: true },
            { id: 'sda-scarlett', name: 'Scarlett', url: logoScarlett, isPreloaded: true },
            { id: 'sda-treefrog', name: 'Treefrog', url: logoTreefrog, isPreloaded: true },
            { id: 'sda-velvet', name: 'Velvet', url: logoVelvet, isPreloaded: true },
            { id: 'sda-white', name: 'White', url: logoWhite, isPreloaded: true },
            { id: 'sda-winter', name: 'Winter', url: logoWinter, isPreloaded: true }
        ]
    }
];
