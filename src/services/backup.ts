import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { toDateKey } from '../domain/dates';
import { BackupFile, Repository } from '../db/repository';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
const KEEP_AUTO_BACKUPS = 7;

function fileName(prefix = 'my-tasks-backup') {
  const d = new Date();
  const stamp = `${toDateKey(d)}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `${prefix}-${stamp}.json`;
}

/** Exports the full database as JSON and opens the system share sheet (Drive, email, Files...). */
export async function exportAndShare(repo: Repository): Promise<void> {
  const data = await repo.exportAll();
  const json = JSON.stringify(data, null, 2);
  const name = fileName();
  if (!isNative) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'حفظ النسخة الاحتياطية' });
  }
}

/** Lets the user pick a backup file and returns its parsed content (or null if cancelled). */
export async function pickBackup(): Promise<unknown | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  let text: string;
  if (isNative) {
    text = await new File(asset.uri).text();
  } else {
    text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('تعذّرت قراءة الملف. تأكد أنه ملف نسخة احتياطية بصيغة JSON.');
  }
}

function backupDir(): Directory {
  const dir = new Directory(Paths.document, 'backups');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Daily automatic snapshot kept on the device (last 7 days). */
export async function autoBackup(repo: Repository): Promise<boolean> {
  if (!isNative) return false;
  const data = await repo.exportAll();
  const dir = backupDir();
  const file = new File(dir, `auto-${toDateKey(new Date())}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data));
  const files = dir
    .list()
    .filter((f): f is File => f instanceof File && f.name.startsWith('auto-'))
    .sort((a, b) => (a.name < b.name ? 1 : -1));
  for (const old of files.slice(KEEP_AUTO_BACKUPS)) old.delete();
  return true;
}

export interface LocalBackup {
  name: string;
  date: string;
  file: File;
}

export function listAutoBackups(): LocalBackup[] {
  if (!isNative) return [];
  try {
    return backupDir()
      .list()
      .filter((f): f is File => f instanceof File && f.name.startsWith('auto-'))
      .map((f) => ({ name: f.name, date: f.name.replace('auto-', '').replace('.json', ''), file: f }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

export async function readLocalBackup(b: LocalBackup): Promise<BackupFile> {
  return JSON.parse(await b.file.text());
}
