import { NativeModules } from 'react-native';

const { BitzTrackInfoModule } = NativeModules

class BitzTrackInfo {
    constructor() {}

    async getVersionName() {
        return await BitzTrackInfoModule.getVersionName()
    }

}

export default new BitzTrackInfo()