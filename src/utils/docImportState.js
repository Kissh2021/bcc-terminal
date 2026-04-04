/**
 * docImportState.js — State partagé pour passer un doc à éditer
 * depuis DocumentList vers DocImportView.
 */

let pendingEditDoc = null;

export function setEditDoc(doc)  { pendingEditDoc = doc; }
export function getEditDoc()     { return pendingEditDoc; }
export function clearEditDoc()   { pendingEditDoc = null; }
