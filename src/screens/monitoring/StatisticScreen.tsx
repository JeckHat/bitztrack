import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import dayjs from 'dayjs'
import { useDispatch } from "react-redux";

import { CustomText } from "@components";
import { uiActions } from "@store/actions";

export default function StatisticScreen() {
    const [data, setData] = useState({})

    const dispatch = useDispatch()

    useEffect(() => {
        loadWorkers()
    }, [])

    function toUtcDate(dateString: string) {
        if (!dateString.endsWith('Z')) {
            return new Date(dateString + 'Z');
        }
        return new Date(dateString);
    }
      
    function deduplicateAndLabelWorkers(data: { name: string, minute: string, khs: number }[]) {
        const latestMap = new Map();
        let activeCount = 0
    
        // Step 1: Deduplicate
        data.forEach(item => {
            const existing = latestMap.get(item.name);
            if (!existing || toUtcDate(item.minute) > toUtcDate(existing.minute)) {
                latestMap.set(item.name, item);
            }
        });
    
        const nowUtcMs = Date.now();
        const twoMinutesMs = 2 * 60 * 1000;
        let totalHashrate = 0
    
        // Step 2: Label each worker active/inactive
        const workers = Array.from(latestMap.values()).map(worker => {
            const workerTimeMs = toUtcDate(worker.minute).getTime();
            const isActive = nowUtcMs - workerTimeMs <= twoMinutesMs;
            if(isActive) {
                activeCount++
                totalHashrate += worker.khs
            }
        
            return {
                ...worker,
                isActive: isActive,
                offlineHours: isActive? 0 : (nowUtcMs - workerTimeMs) / 1000 / 60 / 60
            };
        });
    
        // Step 3: Sort by name A-Z
        workers.sort((a, b) => a.name.localeCompare(b.name));
    
        return { workers, activeCount, totalHashrate };
    }

    async function loadWorkers(toleranceMinutes = 2) {
        dispatch(uiActions.showLoading(true))
        try {
            const now = dayjs()
            let totalHashrate = 0;
            let activeCount = 0;

            const response = await fetch('https://api.gpool.cloud/member/7quEeAYjHqXsrR5MNRtsLKz3vfZL7CtoaLjpaFotqaFu/workers', {
                method: 'GET'
            })
            const rawWorkers = await response.json()

            const newData = deduplicateAndLabelWorkers(rawWorkers);

            setData({
                workers: newData.workers,
                totalHashrate: newData.totalHashrate,
                activeCount: newData.activeCount

            })
            
            console.log(newData)

            return

            

            // console.log(rawWorkers.slice(0, 1000))

            // const workers = deduplicateWorkers(rawWorkers)

            // console.log("workers", workers)

            // const allWorkers = workers.map(worker => {
            //     const lastUpdate = dayjs(worker.minute);
            //     const diffMinutes = now.diff(lastUpdate, 'minute');
            //     const isActive = diffMinutes <= 300;
            
            //     if (isActive) {
            //         activeCount++;
            //         totalHashrate += worker.khs;
            //     }
            
            //     return {
            //         name: worker.name,
            //         status: isActive ? 'aktif' : 'tidak aktif',
            //         hashrate: Number(worker.hashrate),
            //         lastSeen: lastUpdate.format('HH:mm:ss'),
            //         offlineMinutes: isActive ? 0 : diffMinutes
            //     };
            // });

            // const chartData = rawWorkers.map(worker => ({
            //     minute: dayjs(worker.minute).format('YYYY-MM-DD HH:mm'),
            //     worker: worker.name,
            //     hashrate: worker.khs
            // })).sort((a, b) => {
            //     if (a.minute === b.minute) {
            //       return a.worker.localeCompare(b.worker);
            //     }
            //     return dayjs(a.minute).isAfter(dayjs(b.minute)) ? 1 : -1;
            // });
            
            // const totalHashratePerMinuteMap = new Map();
            // rawWorkers.forEach(worker => {
            //     const minute = dayjs(worker.minute).format('YYYY-MM-DD HH:mm');
            //     const existingHashrate = totalHashratePerMinuteMap.get(minute) || 0;
            //     totalHashratePerMinuteMap.set(minute, existingHashrate + worker.khs);
            // });
            
            // const totalHashratePerMinute = Array.from(totalHashratePerMinuteMap.entries())
            //     .map(([minute, totalHashrate]) => ({
            //       minute,
            //       totalHashrate
            //     }))
            //     .sort((a, b) => dayjs(a.minute).isAfter(dayjs(b.minute)) ? 1 : -1);
            
            // setData({
            //     totalWorkers: workers.length,
            //     activeCount,
            //     inactiveCount: workers.length - activeCount,
            //     totalHashrate,
            //     workers: allWorkers,
            //     chartData,
            //     totalHashratePerMinute
            // })
        } catch (error) {
            console.log("error", error)
        } finally {
            dispatch(uiActions.showLoading(false))
        }
          
    }

    return (
        <SafeAreaView className="flex-1 bg-baseBg">
            <ScrollView>
            <View>
                <CustomText className="text-primary">{data?.totalHashrate ?? "0.0"}</CustomText>
            </View>
            <View>
                <CustomText className="text-primary">{data?.activeCount ?? 0}/{data?.workers?.length ?? 0}</CustomText>
            </View>
            <View className="flex-row gap-2 justify-between mx-2">
                <View className="flex-1 items-center">
                    <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                        Name
                    </CustomText>
                </View>
                <View className="flex-1 items-center">
                    <CustomText
                        className={`text-primary font-PlusJakartaSansSemiBold flex-1`}
                    >
                        Status
                    </CustomText>
                </View>
                <View className="flex-1 items-center">
                    <CustomText className={`text-primary font-PlusJakartaSansSemiBold flex-1`}>
                        Offline Hours
                    </CustomText>
                </View>
            </View>
            {data?.workers?.map((worker, idx) => (
                <View key={`worker-${idx}`} className="flex-row gap-2 justify-between mx-2 flex-1">
                    <View className="flex-1 items-center">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                            {worker.name}
                        </CustomText>
                    </View>
                    <View className="flex-1 items-center">
                        <CustomText
                            className={`${worker.isActive? 'text-green-600' : 'text-red-500'} flex-1 font-PlusJakartaSansSemiBold`}
                        >
                            {worker.isActive ? 'active' : 'inactive'}
                        </CustomText>
                    </View>
                    <View className="flex-1 items-center">
                        <CustomText className={`text-primary font-PlusJakartaSansSemiBold flex-1`}>
                            {worker.isActive ? "-" : `${(worker.offlineHours).toFixed(2)} hours ago`}
                        </CustomText>
                    </View>
                </View>
            ))}
            </ScrollView>
        </SafeAreaView>
    )
}

