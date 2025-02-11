import { BiometricsState } from '../../../storage/secureStorage';
import { biometricsState } from '../../state/biometricsAndPasscode';
import { useRecoilValue } from 'recoil';

export function useBiometricsState(): BiometricsState {
    return useRecoilValue(biometricsState);
}