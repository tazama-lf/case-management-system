import { ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import React from "react";
import { evidenceService } from "../../services/evidenceService";
import type { Evidence } from "../../types";

interface DeleteEvidenceModalProps {
    evidenceToDelete: {
        id: string;
        fileName: string;
    } | null;
    setEvidenceToDelete: React.Dispatch<React.SetStateAction<{
        id: string;
        fileName: string;
    } | null>>;
    setUploadedEvidence: React.Dispatch<React.SetStateAction<Record<string, Evidence[]>>>;
    onDeleteSuccess?: () => void;
}


const DeleteEvidenceModal: React.FC<DeleteEvidenceModalProps> = ({
    evidenceToDelete,
    setEvidenceToDelete,
    setUploadedEvidence,
    onDeleteSuccess,
}) => {
    const [isDeleting, setIsDeleting] = React.useState(false);
    const handleConfirmDelete = async () => {
        if (!evidenceToDelete) return;

        try {
            setIsDeleting(true);
            await evidenceService.deleteEvidence(evidenceToDelete.id, evidenceToDelete.fileName);

            setUploadedEvidence(prev => {
                const updated: typeof prev = {};
                Object.keys(prev).forEach(sectionKey => {
                    updated[sectionKey] = prev[sectionKey].filter(
                        e => e.id !== evidenceToDelete.id
                    );
                });
                return updated;
            });

            onDeleteSuccess?.();

            setEvidenceToDelete(null);
        } finally {
            setIsDeleting(false);
        }
    };

    return <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
                <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                    </span>
                    Delete Evidence?
                </h3>

                <p className="mt-4 text-sm text-gray-600">
                    This action cannot be undone. Are you sure you want to delete <span className="font-bold text-gray-800">
                        {evidenceToDelete?.fileName}
                    </span>
                    ?
                </p>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={() => setEvidenceToDelete(null)}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm"
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleConfirmDelete}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        disabled={isDeleting}
                    >
                        {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>

    </>
}
export default DeleteEvidenceModal;