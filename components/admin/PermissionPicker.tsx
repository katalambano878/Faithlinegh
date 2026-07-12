'use client';

import { PERMISSION_KEYS, PERMISSION_LABELS } from '@/lib/admin-permissions';

interface PermissionPickerProps {
  permissions: Record<string, boolean>;
  onChange: (permissions: Record<string, boolean>) => void;
  disabled?: boolean;
}

export default function PermissionPicker({ permissions, onChange, disabled = false }: PermissionPickerProps) {
  const enabledCount = PERMISSION_KEYS.filter((k) => permissions[k]).length;

  const toggle = (key: string) => {
    onChange({ ...permissions, [key]: !permissions[key] });
  };

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    PERMISSION_KEYS.forEach((key) => {
      // Never auto-grant roles management to staff
      next[key] = key === 'roles' ? false : value;
    });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-semibold text-gray-700">Feature Permissions</label>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose which admin sections this staff member can access ({enabledCount} of {PERMISSION_KEYS.length} enabled)
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAll(true)}
            disabled={disabled}
            className="px-2.5 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Enable all
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            disabled={disabled}
            className="px-2.5 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Disable all
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/50 p-3">
        <div className="grid sm:grid-cols-2 gap-2">
          {PERMISSION_KEYS.map((key) => {
            const perm = PERMISSION_LABELS[key];
            const isEnabled = permissions[key] === true;
            return (
              <button
                type="button"
                key={key}
                onClick={() => toggle(key)}
                disabled={disabled}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all disabled:opacity-50 ${
                  isEnabled
                    ? 'border-brand-brown/20 bg-brand-cream/60 hover:border-brand-brown/30'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                    isEnabled ? 'bg-brand-brown/10 text-brand-brown' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <i className={`${perm.icon} text-sm`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-semibold ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                      {perm.label}
                    </span>
                    {isEnabled ? (
                      <i className="ri-checkbox-circle-fill text-brand-brown text-base shrink-0" />
                    ) : (
                      <i className="ri-checkbox-blank-circle-line text-gray-300 text-base shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{perm.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
