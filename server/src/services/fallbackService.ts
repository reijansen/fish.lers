import { getFirestore } from '../config/firebase.js';
import { UserBackup } from '../models/backup/userBackup.js';
import { EquipmentBackup } from '../models/backup/equipmentBackup.js';
import { RequestBackup } from '../models/backup/requestBackup.js';
import mongoose from 'mongoose';
import { isMongoConnected } from '../config/mongodb.js';

const modelMap: Record<string, mongoose.Model<any>> = {
  users:     UserBackup,
  equipment: EquipmentBackup,
  requests:  RequestBackup,
};

// Read a single document
export const getDocument = async (
  collection: string,
  docId: string
): Promise<Record<string, any> | null> => {
  if (!isMongoConnected()) {
    return null;
  }

  try {
    const db  = getFirestore();
    const doc = await db.collection(collection).doc(docId).get();
    if (doc.exists) return { id: doc.id, ...doc.data() };
    return null;
  } catch {
    console.warn(`⚠️ Firestore down — reading ${collection}/${docId} from MongoDB...`);
    const model  = modelMap[collection];
    const backup = await model?.findOne({ docId });
    return backup ? backup.toObject() : null;
  }
};

// Read an entire collection
export const getCollection = async (
  collection: string
): Promise<Record<string, any>[]> => {
  if (!isMongoConnected()) {
    return [];
  }

  try {
    const db       = getFirestore();
    const snapshot = await db.collection(collection).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch {
    console.warn(`⚠️ Firestore down — reading collection ${collection} from MongoDB...`);
    const model   = modelMap[collection];
    const backups = await model?.find() ?? [];
    return backups.map(b => ({ id: b.docId, ...b.toObject() }));
  }
};