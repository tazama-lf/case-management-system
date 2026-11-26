import { stripInternalAttachmentFields } from '../src/utils/attachment-response.util';

describe('stripInternalAttachmentFields', () => {
  const attachment = {
    fileName: 'a.pdf',
    hash: 'h',
    filePath: 'http://couchdb:5984/db/doc/a.pdf',
    encryption: { key: 'k', iv: 'i', authTag: 't' },
  };

  it('removes filePath and encryption from attachment entries and keeps the rest', () => {
    expect(stripInternalAttachmentFields([attachment])).toEqual([{ fileName: 'a.pdf', hash: 'h' }]);
  });

  it('removes them at any depth, including nested documents and history', () => {
    const doc = { id: 1, metadata: [attachment], documents: [{ metadata: [attachment] }], history: [{ history: [{ metadata: [attachment] }] }] };

    const json = JSON.stringify(stripInternalAttachmentFields(doc));

    expect(json).not.toContain('filePath');
    expect(json).not.toContain('encryption');
    expect(json).toContain('a.pdf');
  });

  it('does not modify its input', () => {
    const doc = { metadata: [attachment] };

    stripInternalAttachmentFields(doc);

    expect(doc.metadata[0].encryption.key).toBe('k');
    expect(doc.metadata[0].filePath).toContain('couchdb');
  });

  it('passes dates, primitives and null through', () => {
    const date = new Date();

    expect(stripInternalAttachmentFields({ at: date, n: 1, s: 'x', z: null }).at).toBe(date);
    expect(stripInternalAttachmentFields(null)).toBeNull();
    expect(stripInternalAttachmentFields('x')).toBe('x');
  });
});
