import { UserBackup } from '../models/backup/userBackup.js';
import { User } from '../models/user.js';

export const getUserFromMongo = async (uid: string): Promise<User | null> => {
    const backup = await UserBackup.findOne({ docId: uid });
    if (!backup) return null;

    return {
        uid: backup.docId,
        email: backup.email ?? '',
        displayName: backup.displayName ?? undefined,
        role: backup.role ?? 'student',
        isSuperAdmin: backup.isSuperAdmin ?? false,
        isActive: backup.isActive ?? true,
        createdAt: backup.createdAt ?? undefined,
        updatedAt: backup.updatedAt ?? undefined,
    };
};