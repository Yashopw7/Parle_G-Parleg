# Security Specification: Dynamic NFC Business Card Platform

## 1. Data Invariants
1. **Permanent Card Identity**: `cardId`, `creatorUid`, and `createdAt` are immutable once created.
2. **Strict Ownership Isolation**: A business card can only be updated by its authorized `ownerUid`. Public users and other authenticated users cannot modify or delete another business's card.
3. **PIN Privacy**: Setup PIN hashes (`setupPinHash`) and owner edit PIN hashes (`ownerPinHash`) live exclusively in `cardPrivate/{cardId}`, never in `cards/{cardId}`. Public users and unowned authenticated users can never read `cardPrivate/{cardId}`.
4. **Atomic Provisioning & Claiming**: Creating a card requires atomically creating `cardPrivate/{cardId}`. Claiming an unclaimed card (`ownerUid == null`) requires verifying `submittedPinHash == existing().setupPinHash` inside `cardPrivate/{cardId}` and atomically setting `ownerUid = request.auth.uid` on both documents via `getAfter()`.
5. **Button Cap Enforcement**: Total active public buttons (`googleReviewUrl`, `whatsapp`, `instagram`, `facebook`, `website`, plus `customLinks.size()`) must never exceed 7.
6. **Zero-Blanket List Queries**: Public users cannot list `cards` or `cardPrivate`. Authenticated users can list `cards` only where `resource.data.ownerUid == request.auth.uid` or `resource.data.creatorUid == request.auth.uid`.

## 2. Adversarial "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Create**: Create `/cards/evil-1` with `request.auth == null`.
2. **Identity Spoofing on Create**: Signed-in user A creates `/cards/spoof-1` with `creatorUid: "user-B"` or `ownerUid: "user-B"`.
3. **Orphaned Card Create (Missing Private Doc)**: Signed-in user A creates `/cards/orphan-1` without creating `/cardPrivate/orphan-1` in the same batch.
4. **Shadow Ghost Field Injection**: Signed-in owner updates `/cards/c1` including an undeclared field `isAdmin: true`.
5. **Cross-Tenant Overwrite**: Signed-in user B attempts to update `/cards/c1` owned by user A.
6. **Public Visitor Edit Attempt**: Unauthenticated visitor attempts to update `googleReviewUrl` on `/cards/c1`.
7. **Setup PIN Leak Read**: Public user or non-owner user B attempts `get` or `list` on `/cardPrivate/c1`.
8. **Wrong Setup PIN Claim**: User B tries to claim unclaimed `/cardPrivate/c2` with `submittedPinHash: "wronghash"`.
9. **Re-Claim Already Owned Card**: User B tries to claim `/cards/c1` where `ownerUid != null`.
10. **Button Limit Overflow**: Owner updates `/cards/c1` with 5 standard links + 3 custom links (8 total buttons > 7).
11. **Path ID Poisoning**: User creates `/cards/invalid..slash$id` or 200-char ID.
12. **Blanket List Scraping**: Signed-in user runs unconstrained `getDocs(collection(db, 'cards'))` without owner/creator filter.
