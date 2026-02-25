import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ScanReport } from './types';

const COLLECTION = 'tqa_reports';

export async function saveReport(report: Omit<ScanReport, 'id' | 'created_at'>): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...report,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export interface ReportFilter {
  theme?: string;
  risk_level?: 'none' | 'low' | 'moderate' | 'high' | 'all';
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

export async function fetchReports(filter: ReportFilter = {}): Promise<ScanReport[]> {
  let q = query(collection(db, COLLECTION), orderBy('created_at', 'desc'));

  const snapshot = await getDocs(q);
  let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ScanReport));

  if (filter.theme) {
    const t = filter.theme.toLowerCase();
    docs = docs.filter(d => d.theme?.toLowerCase().includes(t));
  }
  if (filter.risk_level && filter.risk_level !== 'all') {
    docs = docs.filter(d => d.risk_level === filter.risk_level);
  }
  if (filter.dateFrom) {
    docs = docs.filter(d => {
      const ts = d.created_at instanceof Timestamp ? d.created_at.toDate() : new Date(d.created_at);
      return ts >= filter.dateFrom!;
    });
  }
  if (filter.dateTo) {
    const end = new Date(filter.dateTo);
    end.setHours(23, 59, 59, 999);
    docs = docs.filter(d => {
      const ts = d.created_at instanceof Timestamp ? d.created_at.toDate() : new Date(d.created_at);
      return ts <= end;
    });
  }

  return docs;
}
