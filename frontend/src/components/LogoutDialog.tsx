import { AnimatePresence, motion } from "framer-motion";
import { ShieldQuestionMarkIcon } from "lucide-react";

interface LogoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutDialog({ isOpen, onClose, onConfirm }: LogoutDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden pointer-events-auto flex flex-col"
            >
              <div className="flex flex-col items-center justify-center gap-3 p-8">
                <div className="flex size-14 items-center justify-center rounded-full bg-violet-50 text-violet-600 shadow-inner">
                  <ShieldQuestionMarkIcon className="size-7" />
                </div>
                <h2 className="text-center font-bold text-lg text-slate-900 mt-2">
                  Are you sure?
                </h2>
                <p className="text-center font-medium text-sm text-slate-500 px-4">
                  You can always log in later to your account.
                </p>
              </div>
              
              <div className="grid w-full grid-cols-2 divide-x divide-slate-200 border-t border-slate-200 bg-slate-50/50">
                <button
                  onClick={onClose}
                  className="h-14 font-semibold text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:bg-slate-100"
                >
                  No
                </button>
                <button
                  onClick={onConfirm}
                  className="h-14 font-bold text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:bg-red-50"
                >
                  Yes, Logout
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
