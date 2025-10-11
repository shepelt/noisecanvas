# AI Development Rules for NoiseCanvas

## Project Overview
NoiseCanvas is a web-based sample playback engine for learning music theory through code. Built with a bottom-up approach where musical concepts emerge naturally from implementation.

**Important**: Read `README.md` for project structure, API endpoints, and current architecture (Express + Web Audio)

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
- **Backend**: Node.js + Express (REST API)
- **Frontend**: Web Audio API (browser-based audio)
- **Language**: JavaScript (ES6+ modules)
- **Testing**: Jest (unit tests) + Playwright (web tests)
- **Build**: Vite (dev server + bundler)

## Project Structure

Organized into clear layers:

```
/noisecanvas
  /server           # Express API server
    /services       # Core business logic (transport-independent)
    /routes         # REST API endpoints
  /web              # Web Audio sampler + frontend
    sampler-web.js  # Web Audio API implementation
    midi-web.js     # Web MIDI integration
    index.html      # Demo page
  /data/samples     # Audio sample files (WAV)
  /bin              # CLI tools (play-pattern.js)
  backlog.md        # Task management and progress tracking
```

### Task Management
- Use backlog.md as progress and task management framework
- Completed tasks are documented with TASK-N naming
- TODO section contains focused suggestions for next steps

## Development Workflow

### Test-Driven Development (TDD)
- Write tests first, then implement
- Keep tests simple and focused on one concept
- Test the sound/musical result, not just code correctness
- **Test naming conventions**
  - Use underscores instead of spaces or hyphens: `test('pattern_beat')`
  - Keep names short but descriptive: function name + brief context
  - Good: `pattern_beat`, `notes_octaves`, `load_custom_basenote`
  - Bad: `should play a pattern with kick and snare beat`
  - Run specific test: `npm run test:unit:filter pattern_beat`
- **Test layers**
  - Unit tests (Jest): Pure logic in services (PatternService)
  - Web tests (Playwright): Browser-based Web Audio functionality
  - Integration tests: Full API → Web Audio flow
- Example cycle:
  1. Write test: "Play C-D-E pattern at 120 BPM"
  2. Run test (fails)
  3. Implement minimal code to pass
  4. Listen to result in browser
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