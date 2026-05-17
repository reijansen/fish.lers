import { getFirestore } from '../config/firebase.js';
import { UserBackup } from '../models/backup/userBackup.js';
import { EquipmentBackup } from '../models/backup/equipmentBackup.js';
import { RequestBackup } from '../models/backup/requestBackup.js';
import { ConversationBackup } from '../models/backup/conversationBackup.js';
import { MessageBackup } from '../models/backup/messageBackup.js';
import { ReadStateBackup } from '../models/backup/readStateBackup.js';
import mongoose, { Model } from 'mongoose';

const listeners: Array<{ collection: string; model: mongoose.Model<any> }> = [ 
  { collection: 'users',           model: UserBackup },
  { collection: 'equipment',       model: EquipmentBackup },
  { collection: 'requests',        model: RequestBackup },
  { collection: 'chat_read_state', model: ReadStateBackup },
];

export const startFirestoreListeners = (): void => {
  const db = getFirestore();
  const activeMessageListeners = new Set<string>(); // Track which conversations have listeners

  // ✅ Regular collections
  for (const { collection, model } of listeners) {
    db.collection(collection).onSnapshot(
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const docId = change.doc.id;
          const data  = change.doc.data();

          try {
            if (change.type === 'added' || change.type === 'modified') {
              await model.findOneAndUpdate(
                { docId },
                { docId, ...data },
                { upsert: true, returnDocument: 'after' }
              );
              console.log(`🔄 Backed up ${collection}/${docId}`);
            }
            if (change.type === 'removed') {
              await model.deleteOne({ docId });
              console.log(`🗑️ Removed backup ${collection}/${docId}`);
            }
          } catch (err) {
            console.error(`❌ Error backing up ${collection}/${docId}:`, err);
          }
        }
      },
      (err) => console.error(`❌ Listener error on ${collection}:`, err)
    );

    console.log(`👂 Listening to Firestore collection: ${collection}`);
  }

  // ✅ Chat conversations + messages subcollection
  db.collection('chat_conversations').onSnapshot(
    async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id;
        const data  = change.doc.data();

        try {
          if (change.type === 'added' || change.type === 'modified') {
            await (ConversationBackup as Model<any>).findOneAndUpdate(
              { docId },
              { docId, ...data },
              { upsert: true, returnDocument: 'after' }
            );
            console.log(`🔄 Backed up conversation ${docId}`);

            // Attach message listener only once per conversation
            if (!activeMessageListeners.has(docId)) {
              activeMessageListeners.add(docId);
              
              db.collection('chat_conversations')
                .doc(docId)
                .collection('messages')
                .onSnapshot(
                  async (msgSnapshot) => {
                    for (const msgChange of msgSnapshot.docChanges()) {
                      const msgDocId = msgChange.doc.id;
                      const msgData  = msgChange.doc.data();

                      try {
                        if (msgChange.type === 'added' || msgChange.type === 'modified') {
                          await (MessageBackup as Model<any>).findOneAndUpdate(
                            { docId: msgDocId },
                            { docId: msgDocId, conversationID: docId, ...msgData },
                            { upsert: true, returnDocument: 'after' }
                          );
                          console.log(`🔄 Backed up message ${docId}/${msgDocId}`);
                        }
                        if (msgChange.type === 'removed') {
                          await (MessageBackup as Model<any>).deleteOne({ docId: msgDocId });
                          console.log(`🗑️ Removed message ${docId}/${msgDocId}`);
                        }
                      } catch (err) {
                        console.error(`❌ Error backing up message ${docId}/${msgDocId}:`, err);
                      }
                    }
                  },
                  (err) => console.error(`❌ Message listener error for ${docId}:`, err)
                );
            }
          }

          if (change.type === 'removed') {
            await (ConversationBackup as Model<any>).deleteOne({ docId });
            activeMessageListeners.delete(docId);
            console.log(`🗑️ Removed conversation ${docId}`);
          }
        } catch (err) {
          console.error(`❌ Error backing up chat_conversations/${docId}:`, err);
        }
      }
    },
    (err) => console.error('❌ Listener error on chat_conversations:', err)
  );

  console.log('👂 Listening to Firestore collection: chat_conversations + messages');
};