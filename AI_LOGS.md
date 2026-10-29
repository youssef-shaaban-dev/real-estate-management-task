# AI Session Transcripts & Logs

In accordance with the assessment requirements, the complete session transcripts and interaction logs of our AI assistant sessions are preserved and exported directly in the repository.

---

## 📂 Exported Log Files

The raw session transcripts are located in the [`ai-logs/`](./ai-logs/) directory:

1. **[`ai-logs/transcript.jsonl`](./ai-logs/transcript.jsonl):**
   - The compact JSONL log documenting every user prompt, model thinking process, tool call, and system event throughout the 4-hour assessment session.
2. **[`ai-logs/transcript_full.jsonl`](./ai-logs/transcript_full.jsonl):**
   - The full, unabridged JSONL transcript containing complete payload representations for deep auditing.

---

## 🛠️ Summary of Key AI Collaborations & Human-in-the-Loop Corrections

The candidate maintained strict architectural direction and control over the code generation process. Below are key instances where candidate intervention corrected and guided the AI:

1. **Enforcing `pnpm` Exclusively:**
   - When the AI assistant initially attempted an `npm install`, the candidate stepped in to enforce `pnpm` exclusively, maintaining consistency with the assessment guidelines and lockfile policies.
2. **BigInt Literal Syntax (`0n`) vs. Compiler Target:**
   - The AI initially used `0n` literals in `billing.ts` and `allocation.ts`. Because Next.js 16 defaulted to an ES2017 TypeScript compilation target, this caused `error TS2737: BigInt literals are not available when targeting lower than ES2020`. The candidate noticed the failure during `pnpm build` and had all instances converted to `BigInt(0)`.
3. **React 19 Render Purity (`react-hooks/purity`):**
   - The AI initially called `new Date(Date.now() + 8*3600*1000)` inside the render body of App Router page components (`src/app/tenant/page.tsx`, `src/app/dashboard/page.tsx`). The candidate caught the React 19 compiler error (`Cannot call impure function during render`) and instructed the architecture to extract all date computations into backend service functions (`src/lib/services/`), keeping UI components 100% pure and idempotent.
4. **Secret Scanning Prevention:**
   - When GitHub Push Protection blocked secret keys from `.env.local` that appeared in early file edits, the candidate instructed amending the Git commits and replacing keys in `.env.example` with safe placeholder strings (`replace_with_service_role_key_...`).
5. **Feature-Based Architecture & Shadcn UI Components:**
   - The candidate mandated modularizing monolithic page components into feature folders (`src/features/dashboard/`, `src/features/tenant/`) and utilizing strictly typed Shadcn primitives (`Card`, `Badge`, `Button`, `Table`, `Input`) rather than custom raw HTML elements.
