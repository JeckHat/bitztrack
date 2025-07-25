import { createMigrate, PersistState } from 'redux-persist';
import { RootState } from './types';
import { BOOSTLIST, POOL_LIST } from '@constants';

type PersistedRootState = RootState & {
    _persist: PersistState;
};

const migrations : Record<number, (state: any) => any> = {
    0: (_state: PersistedRootState) : Promise<undefined> => {
        return Promise.resolve(undefined);
    },
    1: (_state: PersistedRootState) : Promise<undefined> => {
        return Promise.resolve(undefined)
    },
};

export default createMigrate(migrations, { debug: true });
