# Advisor Collaboration Architecture

## 1. Vision

Advisor Collaboration Engine (ACE) enables advisors to work together as a cohesive team, sharing opinions, reviewing each other's work, reaching consensus, and resolving conflicts — all without requiring an LLM.

ACE is the foundation for future multi-agent intelligence in Cupaw.

## 2. Core Concepts

### 2.1 Opinion

An **Opinion** is one advisor's recommendation on a topic. It is requested by one advisor and provided by another.

```typescript
interface AdvisorOpinion {
  opinionId: string;
  advisorId: AdvisorId;           // Who provided the opinion
  topic: string;
  summary: string;
  details: string[];
  confidence: number;             // 0-1
  recommendations: string[];
  status: OpinionStatus;
}
```

**Flow:**
```
Caller Advisor → requestOpinion() → Target Advisor
                                    ↓
                              Opinion returned
```

### 2.2 Review

A **Review** is one advisor's evaluation of another advisor's work.

```typescript
interface AdvisorReview {
  reviewId: string;
  reviewer: AdvisorId;            // Who reviewed
  target: AdvisorId;              // Whose work was reviewed
  topic: string;
  summary: string;
  issues: string[];
  recommendations: string[];
  approvalStatus: ApprovalStatus;
}
```

**Flow:**
```
Reviewer → requestReview() → Target
                              ↓
                        Review returned
```

### 2.3 Consensus

**Consensus** is the result of multiple advisors discussing and reaching agreement.

```typescript
interface AdvisorConsensus {
  consensusId: string;
  discussionId: string;
  topic: string;
  agreedOpinions: { advisorId, summary }[];
  disagreedOpinions: { advisorId, summary }[];
  decision: string;
  reason: string;
  confidence: number;
}
```

**Flow:**
```
Facilitator → startDiscussion() → Participants
                                    ↓
                              Messages exchanged
                                    ↓
                              requestConsensus()
                                    ↓
                              Consensus result
```

### 2.4 Debate

A **Debate** occurs when two advisors disagree. Both positions are preserved.

```typescript
interface AdvisorDebate {
  debateId: string;
  advisorA: AdvisorId;
  advisorB: AdvisorId;
  topic: string;
  positionA: string;
  positionB: string;
  resolved: boolean;
  resolution?: DebateResolution;
  winner?: AdvisorId;
}
```

**Flow:**
```
Advisor A ←→ startDebate() → Advisor B
       ↓                        ↓
   Position A              Position B
       ↓                        ↓
       └──────── Debate ────────┘
                    ↓
              resolveDebate()
                    ↓
           Resolution / Escalation
```

### 2.5 Escalation

When consensus cannot be reached, the decision is escalated to the **Chief AI Architect**.

```
Discussion (no consensus)
    ↓
escalateDecision()
    ↓
AdvisorInvocation → Chief AI Architect
    ↓
Chief AI Architect makes final decision
```

## 3. Collaboration Engine API

### 3.1 Public Interface

```typescript
interface IAdvisorCollaborationEngine {
  requestOpinion(...): AdvisorOpinion;
  requestReview(...): AdvisorReview;
  startDiscussion(...): AdvisorDiscussion;
  requestConsensus(discussionId): AdvisorConsensus;
  startDebate(...): AdvisorDebate;
  escalateDecision(discussionId, reason): AdvisorInvocation;
  getDiscussion(discussionId): AdvisorDiscussion | undefined;
  listDiscussions(): readonly AdvisorDiscussion[];
  addMessage(discussionId, advisorId, content): AdvisorDiscussion;
  delegateTask(...): AdvisorTask;
  resolveDebate(debateId, resolution, winner?): AdvisorDebate;
}
```

### 3.2 Dependencies

- **AdvisorCatalog**: For advisor validation
- **EventBus**: For event publishing
- No other runtime dependencies

## 4. Collaboration Flows

### 4.1 Opinion Flow

```
1. Caller advisor requests opinion from target advisor
2. Engine validates both advisors exist
3. Engine creates AdvisorOpinion with status SUBMITTED
4. Engine publishes OpinionCreated event
5. Opinion is returned to caller
```

### 4.2 Review Flow

```
1. Reviewer advisor requests review of target's work
2. Engine validates both advisors exist
3. Engine creates AdvisorReview with status PENDING
4. Engine publishes ReviewCompleted event
5. Review is returned to reviewer
```

### 4.3 Discussion Flow

```
1. Facilitator starts discussion with topic and participants
2. Engine validates facilitator exists
3. Engine deduplicates participants
4. Engine creates AdvisorDiscussion with status ACTIVE
5. Engine publishes DiscussionStarted event
6. Participants exchange messages via addMessage()
7. Participants submit opinions via requestOpinion()
8. Facilitator requests consensus via requestConsensus()
9. Engine generates consensus from opinions
10. Engine publishes ConsensusReached or ConsensusFailed event
11. Discussion status updated to COMPLETED or FAILED
```

### 4.4 Debate Flow

```
1. Two advisors start debate with conflicting positions
2. Engine validates both advisors exist and are different
3. Engine creates AdvisorDebate with resolved=false
4. Engine publishes DebateStarted event
5. Debate remains unresolved until resolveDebate() is called
6. Resolution can be: ADVISOR_A, ADVISOR_B, COMPROMISE, ESCALATED
7. Engine publishes DebateResolved event
```

### 4.5 Escalation Flow

```
1. Discussion fails to reach consensus
2. Facilitator calls escalateDecision()
3. Engine creates AdvisorInvocation to Chief AI Architect
4. Engine publishes DecisionEscalated event
5. Chief AI Architect makes final decision
```

## 5. Event Flow

All collaboration operations publish events to the EventBus:

| Event | When Published | Payload |
|-------|---------------|---------|
| `AdvisorInvoked` | Opinion requested | `AdvisorInvocation` |
| `DiscussionStarted` | Discussion created | `AdvisorDiscussion` |
| `OpinionCreated` | Opinion submitted | `AdvisorOpinion` |
| `ReviewCompleted` | Review submitted | `AdvisorReview` |
| `ConsensusReached` | Consensus successful | `AdvisorConsensus` |
| `ConsensusFailed` | Consensus failed | `AdvisorConsensus` |
| `DebateStarted` | Debate created | `AdvisorDebate` |
| `DebateResolved` | Debate resolved | `AdvisorDebate` |
| `DecisionEscalated` | Decision escalated | `AdvisorInvocation` |
| `TaskDelegated` | Task delegated | `AdvisorTask` |

## 6. Error Handling

All errors extend `CollaborationError`:

- `AdvisorNotFoundError`: Advisor not in catalog
- `DiscussionNotFoundError`: Discussion not found
- `DuplicateParticipantError`: Advisor already in discussion
- `InvalidDiscussionStateError`: Discussion in wrong state
- `DebateUnresolvedError`: Debate cannot be resolved

## 7. Immutability

All collaboration models are immutable:
- Created with factory functions (`createAdvisorOpinion`, etc.)
- All arrays are frozen
- All objects are frozen
- State transitions produce new instances

## 8. Future Extensions

### 8.1 LLM Integration

Future versions will:
- Use LLM to generate opinions and reviews
- Use LLM to moderate discussions
- Use LLM to synthesize consensus
- Use LLM to resolve debates

### 8.2 GUI Integration

Future GUI will:
- Display discussions visually
- Show opinion/review streams
- Visualize debate positions
- Display consensus results

### 8.3 Advanced Features

- Time-limited discussions
- Quorum requirements
- Weighted voting
- Anonymous opinions
- Discussion templates
- Collaboration analytics
