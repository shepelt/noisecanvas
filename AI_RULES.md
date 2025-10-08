# AI Development Rules for NoiseCanvas

## Project Overview
NoiseCanvas is a sample-based music tracker engine for learning music theory through code. Built with a bottom-up approach where musical concepts emerge naturally from implementation.

## Development Philosophy

### Learning Through Building
- **Goal**: Learn music theory by building a music engine, not build an educational product
- **Approach**: Bottom-up discovery - implement primitives, observe emergent patterns, then name them
- **Anti-pattern**: Don't design for teaching others; this is a personal experimental laboratory

### Bottom-Up Development
```
Sound primitives → Experimentation → Pattern discovery → Concept naming → Theory learning
```

NOT:
```
Music theory study → Implementation of concepts
```

## Technology Stack
- **Runtime**: Node.js
- **Language**: JavaScript (ES6+)
- **Audio**: node-speaker (raw PCM output)

## Project Structure

Keep it flat until complexity demands organization:

```
/noisecanvas
  /samples          # Audio samples
  /experiments      # Quick experiments and tests
  notes.md          # Learning journal (discoveries, questions)
```

## Development Workflow

### Test-Driven Development (TDD)
- Write tests first, then implement
- Keep tests simple and focused on one concept
- Test the sound/musical result, not just code correctness
- Example cycle:
  1. Write test: "440Hz sine wave for 1 second"
  2. Run test (fails)
  3. Implement minimal code to pass
  4. Listen to result
  5. Refactor if needed

### Iteration Cycle
```
1. Build something minimal
2. Listen/observe: "Why does this sound good/bad?"
3. Ask Claude: "What's the theory behind this?"
4. Name the concept: "Ah, this is called X"
5. Implement X explicitly in code
6. Move to next experiment
```

### Claude's Role
- **Answer "why"** when I discover something interesting
- **Suggest experiments** when I'm stuck
- **Explain concepts** after I've experienced them
- **Review code** for musicality, not just correctness
- **DO NOT** pre-teach theory or create elaborate structures upfront

## Code Conventions

### Language
- **All code comments and documentation must be in English**
- Variable names, function names, and all identifiers in English
- Commit messages in English
- Only user-facing text (if any) may be in Korean

### Naming
- **Functions**: Describe what they do musically
  - ✅ `pitchShiftSample(sample, semitones)`
  - ✅ `playPattern(pattern, bpm)`
  - ❌ `processSoundData(data, params)`

### Comments
- Explain the **musical concept**, not just the code
  ```javascript
  // Pitch shift by resampling: 2.0 = one octave up (doubling frequency)
  const resampled = resample(sample.data, Math.pow(2, semitones / 12))
  ```

### File Organization
- One concept per file until files get too large (>300 lines)
- Co-locate related functionality
- Split only when pattern emerges naturally

## YAGNI Principle

### Build Only What's Needed Now
- ❌ Don't create abstract base classes before you have 2 concrete ones
- ❌ Don't build effect chains before you have 1 effect working
- ❌ Don't design plugin architecture before you have plugins
- ✅ Start with hardcoded values, extract variables when you need to change them
- ✅ Copy-paste 2 times, refactor on the 3rd

### Examples
```javascript
// ❌ Too early
class BaseInstrument {
  constructor(config) { /* abstraction for future instruments */ }
}

// ✅ Start here
function playKick() {
  const sample = loadSample('kick.wav')
  playSample(sample)
}

// ✅ Then, when you have 3 instruments
function playInstrument(name) {
  const sample = loadSample(`${name}.wav`)
  playSample(sample)
}
```

## Anti-Patterns to Avoid

### Over-Engineering
- ❌ Building a "flexible, extensible architecture" before knowing what you need
- ❌ Creating config files for hardcoded values
- ❌ Abstracting before patterns are clear (3+ examples needed)

### Premature Optimization
- ❌ Optimizing audio performance before it's slow
- ❌ Creating complex data structures before simple ones fail
- ✅ Get it working first, optimize if needed

### Theory-First Learning
- ❌ Reading textbooks before coding
- ❌ Learning all concepts before trying one
- ✅ Experience first, name it later

## Development Rules

### File Modification Protocol
- **NEVER** modify files without explicit user permission
- Show proposed changes first, wait for approval
- Exception: User explicitly requests (e.g., "fix that bug", "add this feature")