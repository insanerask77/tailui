import { useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { ShieldCheck, Check, AlertCircle, Clock, Save, FileText } from 'lucide-react';
import { usePolicy, useSavePolicy } from '../api/policy';
import { toast } from '../stores/toastStore';

// ── HuJSON client-side validator ──────────────────────────────────────────────
// Strips single-line comments and trailing commas, then parses as JSON
function validateHujson(text: string): string | null {
  try {
    const stripped = text
      .replace(/\/\/[^\n]*/g, '')          // strip // comments
      .replace(/\/\*[\s\S]*?\*\//g, '')    // strip /* */ comments
      .replace(/,\s*([}\]])/g, '$1');      // strip trailing commas
    JSON.parse(stripped);
    return null; // valid
  } catch (e) {
    return (e as SyntaxError).message;
  }
}

function fmt(iso: string | null) {
  if (!iso) return 'Never saved';
  return new Intl.DateTimeFormat('default', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AclPage() {
  const { data, isLoading, error } = usePolicy();
  const save = useSavePolicy();

  const [localPolicy, setLocalPolicy] = useState<string | null>(null);
  const [dirty, setDirty]             = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastValidated, setLastValidated]     = useState<boolean | null>(null);

  const value = localPolicy ?? data?.policy ?? '';

  const onChange = useCallback((val: string) => {
    setLocalPolicy(val);
    setDirty(val !== (data?.policy ?? ''));
    setLastValidated(null);
    setValidationError(null);
  }, [data?.policy]);

  function validate() {
    const err = validateHujson(value);
    setValidationError(err);
    setLastValidated(err === null);
    if (err === null) toast.success('Policy syntax is valid');
    else toast.error(`Syntax error: ${err}`);
  }

  async function handleSave() {
    const syntaxErr = validateHujson(value);
    if (syntaxErr) {
      setValidationError(syntaxErr);
      setLastValidated(false);
      toast.error('Fix syntax errors before saving');
      return;
    }
    try {
      await save.mutateAsync(value);
      toast.success('ACL policy saved');
      setDirty(false);
      setLocalPolicy(null);
      setLastValidated(null);
      setValidationError(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function handleDiscard() {
    setLocalPolicy(null);
    setDirty(false);
    setValidationError(null);
    setLastValidated(null);
  }

  return (
    <div className="p-8 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-white">ACL Policy</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-400">HuJSON policy editor</p>
            {data?.updatedAt && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock size={11} /> Last saved: {fmt(data.updatedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Validate button */}
          <button
            onClick={validate}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition ${
              lastValidated === true
                ? 'bg-teal-900 text-teal-300 border border-teal-700'
                : lastValidated === false
                  ? 'bg-red-950 text-red-400 border border-red-800'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            {lastValidated === true
              ? <><Check size={14} /> Valid</>
              : lastValidated === false
                ? <><AlertCircle size={14} /> Invalid</>
                : <><ShieldCheck size={14} /> Validate</>
            }
          </button>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={save.isPending || !dirty}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600
                       hover:bg-blue-500 text-white rounded-lg transition
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/50 border border-red-800/50 text-sm text-red-300 flex-shrink-0">
          {(error as Error).message}
        </div>
      )}

      {/* Dirty / discard bar */}
      {dirty && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-950/40 border border-blue-800/40 rounded-xl mb-4 flex-shrink-0">
          <FileText size={13} className="text-blue-400" />
          <span className="text-xs text-blue-300 flex-1">Unsaved changes</span>
          <button onClick={handleDiscard} className="text-xs text-gray-400 hover:text-white transition">
            Discard
          </button>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="flex items-start gap-2.5 px-4 py-3 bg-red-950/50 border border-red-800/50
                        rounded-xl mb-4 flex-shrink-0">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-red-300">Syntax error</p>
            <p className="text-xs text-red-400 font-mono mt-0.5">{validationError}</p>
          </div>
        </div>
      )}

      {/* HuJSON info */}
      <div className="text-xs text-gray-600 mb-3 flex-shrink-0">
        HuJSON format: JSON with <code className="text-gray-500">// comments</code> and trailing commas allowed.
        Use <code className="text-gray-500">{"{"}"action":"accept","src":["*"],"dst":["*:*"]{"}"}</code> syntax for ACL rules.
      </div>

      {/* Editor */}
      <div className={`flex-1 min-h-0 rounded-xl overflow-hidden border ${
        validationError ? 'border-red-800' : dirty ? 'border-blue-800' : 'border-gray-800'
      }`}>
        {isLoading ? (
          <div className="h-full bg-gray-900 animate-pulse" />
        ) : (
          <CodeMirror
            value={value}
            onChange={onChange}
            extensions={[json()]}
            theme={oneDark}
            height="100%"
            style={{ height: '100%', fontSize: '13px' }}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightSpecialChars: true,
              foldGutter: true,
              drawSelection: true,
              dropCursor: true,
              allowMultipleSelections: false,
              indentOnInput: true,
              syntaxHighlighting: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: false,
              rectangularSelection: false,
              crosshairCursor: false,
              highlightActiveLine: true,
              highlightSelectionMatches: false,
              closeBracketsKeymap: true,
              defaultKeymap: true,
              searchKeymap: false,
              historyKeymap: true,
              foldKeymap: true,
              completionKeymap: false,
              lintKeymap: false,
            }}
          />
        )}
      </div>
    </div>
  );
}
