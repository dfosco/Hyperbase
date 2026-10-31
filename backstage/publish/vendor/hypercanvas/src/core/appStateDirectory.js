import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
export function resolveHypercanvasAppStateDirectory({ environment = process.env, platform = process.platform, home = os.homedir(), } = {}) {
    const configured = environment.HYPERCANVAS_APP_STATE_DIR?.trim();
    if (configured)
        return path.resolve(configured);
    const homeDirectory = environment.HOME || environment.USERPROFILE || home;
    if (platform === 'darwin') {
        return path.resolve(homeDirectory, 'Library', 'Application Support', 'Hypercanvas');
    }
    if (platform === 'win32') {
        return path.resolve(environment.APPDATA || path.join(homeDirectory, 'AppData', 'Roaming'), 'Hypercanvas');
    }
    return path.resolve(environment.XDG_DATA_HOME || path.join(homeDirectory, '.local', 'share'), 'hypercanvas');
}
