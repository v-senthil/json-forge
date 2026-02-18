/* ===================================================================
 * Application state store using React context + useReducer.
 * Lightweight alternative to external state libraries.
 * Handles theme, active tab, JSON input, and parsed data.
 * =================================================================== */

import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';
import type { ViewTab, Theme, ParseResult } from '../types';

interface AppState {
  theme: Theme;
  activeTab: ViewTab;
  jsonInput: string;
  parseResult: ParseResult | null;
  isProcessing: boolean;
  /** For the diff module - second JSON input */
  diffInput: string;
  /** Schema text for validation */
  schemaText: string;
}

type AppAction =
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_TAB'; payload: ViewTab }
  | { type: 'SET_JSON_INPUT'; payload: string }
  | { type: 'SET_PARSE_RESULT'; payload: ParseResult | null }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_DIFF_INPUT'; payload: string }
  | { type: 'SET_SCHEMA_TEXT'; payload: string };

const initialState: AppState = {
  theme: (localStorage.getItem('jf-theme') as Theme) || 'dark',
  activeTab: 'formatter',
  jsonInput: localStorage.getItem('jf-json-input') || '',
  parseResult: null,
  isProcessing: false,
  diffInput: '',
  schemaText: '',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_THEME':
      localStorage.setItem('jf-theme', action.payload);
      return { ...state, theme: action.payload };
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_JSON_INPUT':
      // Debounced persistence happens in the hook
      return { ...state, jsonInput: action.payload };
    case 'SET_PARSE_RESULT':
      return { ...state, parseResult: action.payload, isProcessing: false };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'SET_DIFF_INPUT':
      return { ...state, diffInput: action.payload };
    case 'SET_SCHEMA_TEXT':
      return { ...state, schemaText: action.payload };
    default:
      return state;
  }
}

const AppStateContext = createContext<AppState>(initialState);
const AppDispatchContext = createContext<Dispatch<AppAction>>(() => {});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  return useContext(AppStateContext);
}

export function useAppDispatch() {
  return useContext(AppDispatchContext);
}
