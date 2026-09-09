import { SaveSystem } from './systems/SaveSystem';
import { AudioSystem } from './systems/AudioSystem';
export const save = new SaveSystem();
export const audio = new AudioSystem(save.data.settings);
