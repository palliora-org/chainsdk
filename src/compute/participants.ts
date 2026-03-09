import bs58 from 'bs58';
import { getApi } from '../chain';

export async function getGuardianParticipants(): Promise<any> {
	const api = await getApi();
	if (!api) throw new Error('Api not initialized');

	try {
		const guardians = await api.query.guardian.guardians();
		const nextGuardians = await api.query.guardian.nextGuardians();
		const currentEra = await api.query.staking.currentEra();
		const currentIndex = await api.query.guardian.currentIndex();
		const peerid = await api.rpc.system.localPeerId();
		const _peerid = bs58.decode((peerid || '').toString());
		const account = await api.query.guardian.worker(_peerid.slice(0, 32));
		const nextIndex = currentIndex ? Number(currentIndex) + 1 : 1;

		const guardiansList = (guardians?.toJSON() || []) as any[];
		const nextGuardiansList = (nextGuardians?.toJSON() || []) as any[];

		const buildDetails = async (list: any[]) => {
			return Promise.all(
				list.map(async (guardian: any) => {
					const guardianPrefs = await api.query.staking.guardians(guardian);
					const ledger = await api.query.staking.ledger(guardian);
					const bonded = await api.query.staking.bonded(guardian);
					const payee = await api.query.staking.payee(guardian);
					const stakersOverview = await api.query.staking.erasStakersOverview(
						currentEra?.toPrimitive(),
						guardian,
					);
					const guardianErasPrefs = await api.query.staking.erasGuardianPrefs(
						currentEra?.toPrimitive(),
						guardian,
					);

					return {
						guardian,
						rewardDestination: payee?.toHuman ? payee.toHuman() : null,
						currentPreferences: (guardianErasPrefs?.toHuman ? guardianErasPrefs.toHuman() : null),
						upcomingPreferences: (guardianPrefs?.toHuman ? guardianPrefs.toHuman() : null),
						stash: bonded?.toHuman ? bonded.toHuman() : null,
						currentStakeOverview: stakersOverview?.toHuman ? stakersOverview.toHuman() : null,
						upcomingStakeOverview: ledger?.toHuman ? ledger.toHuman() : null,
					};
				}),
			);
		};

		const currentGuardians = await buildDetails(guardiansList);
		const upcomingGuardians = await buildDetails(nextGuardiansList);

		return {
            nwState: {
                localPeerId: peerid?.toString(),
                worker: account?.toHuman ? account.toHuman() : null,
                currentEra: currentEra?.toHuman ? currentEra.toHuman() : null,
                guardians: JSON.stringify(guardians?.toHuman ? guardians.toHuman() : null, null, 2),
                nextGuardians: JSON.stringify(nextGuardians?.toHuman ? nextGuardians.toHuman() : null, null, 2),
                currentIndex: currentIndex?.toHuman ? currentIndex.toHuman() : null,
                nextIndex,
            },
			currentGuardians,
			upcomingGuardians,
		};
	} finally {
		api.disconnect();
	}
}

export default getGuardianParticipants;

