import { canUpgradeAppState, getAppState, getCurrentAddress, isAddressSecured } from "../storage/appState";
import { storage } from "../storage/storage";
import { PasscodeState, getPasscodeState, loadKeyStorageType } from "../storage/secureStorage";
import { getLockAppWithAuthState } from "../engine/state/lockAppWithAuthState";

export const wasPasscodeSetupShownKey = 'passcode-setup-shown';

function isPasscodeSetupShown(): boolean {
    return storage.getBoolean(wasPasscodeSetupShownKey) ?? false;
}

function isKeyStoreMigrated(): boolean {
    return storage.getBoolean('key-store-migrated') ?? false;
}

type OnboardingState = 'Welcome' | 'WalletUpgrade' | 'PasscodeSetupInit' | 'BackupIntro' | 'Home' | 'AppStartAuth' | 'KeyStoreMigration';

export function resolveOnboarding(isTestnet: boolean, appStart?: boolean): OnboardingState {
    const state = getAppState();
    const wasPasscodeSetupShown = isPasscodeSetupShown();
    const storageType = loadKeyStorageType();
    const isKeyStore = storageType === 'key-store';
    const wasKeyStoreMigrated = isKeyStoreMigrated();
    const authOnStart = getLockAppWithAuthState() ?? false;

    if (state.selected >= 0) {
        if (authOnStart && appStart) {
            return 'AppStartAuth';
        }
        const address = getCurrentAddress();
        if (isAddressSecured(address.address, isTestnet)) {
            const passcodeSet = getPasscodeState() === PasscodeState.Set;

            if (isKeyStore && !wasKeyStoreMigrated) {
                return 'KeyStoreMigration';
            }

            if (!wasPasscodeSetupShown && !passcodeSet) {
                return 'PasscodeSetupInit';
            }
            return 'Home';
        } else if (canUpgradeAppState()) {
            return 'WalletUpgrade'
        } else {
            return 'BackupIntro';
        }
    } else if (canUpgradeAppState()) {
        return 'WalletUpgrade';
    } else {
        return 'Welcome';
    }
}