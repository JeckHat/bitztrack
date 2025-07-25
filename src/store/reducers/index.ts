import { combineReducers } from '@reduxjs/toolkit';

import { uiReducer } from './ui';
import { walletReducer } from './wallet';
import { configReducer } from './config';
import { tokenReducer } from './token'
import { poolReducer } from './pools';
import { boostReducer } from './boost';
import { socketReducer } from './socket';
import { stakeReducer } from './stake';
import { swapReducer } from './swap';

const rootReducer = combineReducers({
    ui: uiReducer,
    wallet: walletReducer,
    config: configReducer,
    token: tokenReducer,
    boost: boostReducer,
    pools: poolReducer,
    socket: socketReducer,
    stake: stakeReducer,
    swap: swapReducer
})

export default rootReducer;
