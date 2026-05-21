import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';

export default function DataMigration() {
  const { user } = useAuth();
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [backfilling, setBackfilling] = useState(false);

  async function migrateAllData() {
    if (!user) return;
    
    try {
      setMigrating(true);
      setMessage('Starting migration...');
      setMessageType('info');

      // Get all requests
      const requestsSnap = await getDocs(collection(db, 'requests'));
      let requestCount = 0;

      for (const docSnap of requestsSnap.docs) {
        const data = docSnap.data();
        // Update createdBy to current admin user
        await updateDoc(doc(db, 'requests', docSnap.id), {
          createdBy: user.uid,
          createdByName: user.displayName || 'Admin',
        });
        requestCount++;
      }

      // Get all accountabilities
      const accountSnap = await getDocs(collection(db, 'accountabilities'));
      let accountCount = 0;

      for (const docSnap of accountSnap.docs) {
        const data = docSnap.data();
        // Update createdBy to current admin user
        await updateDoc(doc(db, 'accountabilities', docSnap.id), {
          createdBy: user.uid,
        });
        accountCount++;
      }

      setMessage(
        `✓ Migration complete!\n` +
        `• Updated ${requestCount} requests\n` +
        `• Updated ${accountCount} accountabilities\n` +
        `All data is now associated with your admin account.`
      );
      setMessageType('success');
    } catch (error: any) {
      setMessage(`✗ Migration failed: ${error.message}`);
      setMessageType('error');
    } finally {
      setMigrating(false);
    }
  }

  async function backfillAccountabilityStudentUid() {
    if (!user) return;

    try {
      setBackfilling(true);
      setMessage('Starting studentUid backfill for accountabilities...');
      setMessageType('info');

      const accountSnap = await getDocs(collection(db, 'accountabilities'));
      let scanned = 0;
      let updated = 0;
      let skipped = 0;
      let unresolved = 0;

      for (const accountDoc of accountSnap.docs) {
        scanned++;
        const data: any = accountDoc.data();

        if (data.studentUid) {
          skipped++;
          continue;
        }

        let resolvedStudentUid: string | null = null;

        if (data.requestId) {
          try {
            const requestSnap = await getDoc(doc(db, 'requests', data.requestId));
            if (requestSnap.exists()) {
              const requestData: any = requestSnap.data();
              if (requestData?.userID) {
                resolvedStudentUid = String(requestData.userID);
              }
            }
          } catch (e) {
            console.warn('Failed resolving request for accountability:', accountDoc.id, e);
          }
        }

        if (!resolvedStudentUid && data.createdBy) {
          try {
            const createdByUserSnap = await getDoc(doc(db, 'users', String(data.createdBy)));
            if (createdByUserSnap.exists()) {
              const userData: any = createdByUserSnap.data();
              if (userData?.role === 'student') {
                resolvedStudentUid = String(data.createdBy);
              }
            }
          } catch (e) {
            console.warn('Failed resolving createdBy user for accountability:', accountDoc.id, e);
          }
        }

        if (!resolvedStudentUid) {
          unresolved++;
          continue;
        }

        await updateDoc(doc(db, 'accountabilities', accountDoc.id), {
          studentUid: resolvedStudentUid,
          updatedAt: new Date().toISOString(),
        });
        updated++;
      }

      setMessage(
        `✓ studentUid backfill complete!\n` +
        `• Scanned: ${scanned}\n` +
        `• Updated: ${updated}\n` +
        `• Already had studentUid: ${skipped}\n` +
        `• Unresolved: ${unresolved}`
      );
      setMessageType(unresolved > 0 ? 'info' : 'success');
    } catch (error: any) {
      setMessage(`✗ studentUid backfill failed: ${error.message}`);
      setMessageType('error');
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Migration Tool</h1>
        <p className="text-base-content/70">Migrate existing Firestore data to your account</p>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Migrate All Requests & Accountabilities</h2>
          <p>This will reassign all existing requests and accountabilities to your current admin account.</p>
          
          <div className="alert alert-warning mt-4">
            <span>⚠️ This action is permanent. Make sure you want to do this before proceeding.</span>
          </div>

          <div className="card-actions justify-end mt-4">
            <button
              className="btn btn-primary"
              disabled={migrating}
              onClick={() => {
                setConfirmInput('');
                setConfirmOpen(true);
              }}
            >
              {migrating ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Migrating...
                </>
              ) : (
                'Migrate Data'
              )}
            </button>
          </div>

          {message && (
            <div className={`alert ${messageType === 'success' ? 'alert-success' : messageType === 'error' ? 'alert-error' : 'alert-info'} mt-4 whitespace-pre-wrap`}>
              <span>{message}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Backfill `studentUid` for Accountabilities</h2>
          <p>
            Safely updates only accountability records missing <code>studentUid</code>, using
            <code>requestId → requests.userID</code> first, then legacy <code>createdBy</code> when it points to a student user.
          </p>
          <div className="alert alert-info mt-4">
            <span>This does not modify existing `studentUid` values.</span>
          </div>
          <div className="card-actions justify-end mt-4">
            <button
              className="btn btn-secondary"
              disabled={backfilling}
              onClick={backfillAccountabilityStudentUid}
            >
              {backfilling ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Backfilling...
                </>
              ) : (
                'Backfill studentUid'
              )}
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !migrating) {
              setConfirmOpen(false);
              setConfirmInput('');
            }
          }}
        >
          <div
            className="bg-base-100 p-4 rounded shadow max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Confirm Data Migration</h3>
            <p className="text-sm text-base-content/70 mt-1">
              This action will reassign existing records and cannot be undone.
              Type CONFIRM to proceed.
            </p>
            <div className="alert alert-warning mt-3">
              <span>Destructive action: type CONFIRM exactly.</span>
            </div>
            <input
              type="text"
              className="input input-bordered w-full mt-3"
              placeholder="Type CONFIRM"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              disabled={migrating}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="btn"
                disabled={migrating}
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmInput('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                disabled={migrating || confirmInput.trim() !== 'CONFIRM'}
                onClick={async () => {
                  setConfirmOpen(false);
                  await migrateAllData();
                }}
              >
                {migrating ? 'Migrating...' : 'Confirm Migration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
