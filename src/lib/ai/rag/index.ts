/**
 * RAG (Retrieval-Augmented Generation) Documents for Smart Explanations
 *
 * These documents provide research-backed guidelines for generating
 * age-appropriate math explanations across grade levels and teaching methodologies.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Grade level band type
export type GradeBand = 'K-2' | '3-5' | '6-8' | '9-12' | 'college';

// Individual grade levels that map to bands
export type GradeLevel =
  | 'K' | '1' | '2'           // K-2 band
  | '3' | '4' | '5'           // 3-5 band
  | '6' | '7' | '8'           // 6-8 band
  | '9' | '10' | '11' | '12'  // 9-12 band
  | 'college';                 // College band

// Teaching methodology types
export type TeachingMethodology =
  | 'standard'        // Default - balanced approach
  | 'singapore'       // Singapore Math / Bar Model / CPA
  | 'traditional'     // Traditional / Direct Instruction / Algorithm-focused
  | 'common-core'     // Common Core - conceptual + procedural balance
  | 'montessori'      // Montessori - hands-on, concrete materials
  | 'saxon'           // Saxon Math - incremental, spiral review
  | 'classical'       // Classical Education - Trivium/Quadrivium
  | 'waldorf';        // Waldorf/Steiner - artistic, movement-based

// Map individual grades to bands
export function getGradeBand(grade: GradeLevel): GradeBand {
  switch (grade) {
    case 'K':
    case '1':
    case '2':
      return 'K-2';
    case '3':
    case '4':
    case '5':
      return '3-5';
    case '6':
    case '7':
    case '8':
      return '6-8';
    case '9':
    case '10':
    case '11':
    case '12':
      return '9-12';
    case 'college':
      return 'college';
    default:
      return '6-8'; // Default to middle school
  }
}

// Grade band display names
export const GRADE_BAND_LABELS: Record<GradeBand, string> = {
  'K-2': 'Kindergarten - 2nd Grade',
  '3-5': '3rd - 5th Grade',
  '6-8': '6th - 8th Grade (Middle School)',
  '9-12': '9th - 12th Grade (High School)',
  'college': 'College / University',
};

// Individual grade display names
export const GRADE_LEVEL_LABELS: Record<GradeLevel, string> = {
  'K': 'Kindergarten',
  '1': '1st Grade',
  '2': '2nd Grade',
  '3': '3rd Grade',
  '4': '4th Grade',
  '5': '5th Grade',
  '6': '6th Grade',
  '7': '7th Grade',
  '8': '8th Grade',
  '9': '9th Grade',
  '10': '10th Grade',
  '11': '11th Grade',
  '12': '12th Grade',
  'college': 'College',
};

// All available grade levels for dropdowns
export const ALL_GRADE_LEVELS: GradeLevel[] = [
  'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'college'
];

// Teaching methodology display names
export const METHODOLOGY_LABELS: Record<TeachingMethodology, string> = {
  'standard': 'Standard (Balanced)',
  'singapore': 'Singapore Math / Bar Model',
  'traditional': 'Traditional / Direct Instruction',
  'common-core': 'Common Core',
  'montessori': 'Montessori',
  'saxon': 'Saxon Math',
  'classical': 'Classical Education',
  'waldorf': 'Waldorf / Steiner',
};

// Methodology descriptions for UI tooltips
export const METHODOLOGY_DESCRIPTIONS: Record<TeachingMethodology, string> = {
  'standard': 'A balanced approach combining conceptual understanding with procedural fluency.',
  'singapore': 'Concrete-Pictorial-Abstract progression with bar models and number bonds. Emphasizes visualization and mental math.',
  'traditional': 'Direct instruction with standard algorithms. Focuses on procedural fluency and memorization of facts.',
  'common-core': 'Balance of conceptual understanding and procedures. Uses tape diagrams, number bonds, and multiple strategies.',
  'montessori': 'Hands-on manipulatives, self-paced learning. Concrete materials before abstract concepts.',
  'saxon': 'Incremental learning with constant spiral review. New concepts daily with cumulative practice.',
  'classical': 'Arithmetic mastery leading to logic-based problem solving. Based on the Quadrivium tradition.',
  'waldorf': 'Movement and artistic integration. Storytelling and rhythm-based learning. Developmental approach.',
};

// All available methodologies for dropdowns
export const ALL_METHODOLOGIES: TeachingMethodology[] = [
  'standard', 'singapore', 'traditional', 'common-core', 'montessori', 'saxon', 'classical', 'waldorf'
];

/**
 * RAG document content - embedded directly to avoid file system issues in serverless
 */
const RAG_CONTENT = {
  gradeBands: `
# Grade Level Bands Summary

## K-2 (Ages 5-8)
- Flesch-Kincaid: Grade 1-2
- Short sentences (5-8 words)
- Simple, familiar words
- HIGH scaffolding
- Enthusiastic, warm tone
- Visual/concrete references

## 3-5 (Ages 8-11)
- Flesch-Kincaid: Grade 3-5
- Moderate sentences (10-15 words)
- Grade-appropriate math vocabulary
- MEDIUM scaffolding
- Encouraging but matter-of-fact
- Written feedback OK

## 6-8 (Ages 11-14)
- Flesch-Kincaid: Grade 6-8
- Longer sentences OK (15 words)
- Standard math terminology
- LOW-MEDIUM scaffolding
- Respectful, peer-like tone
- Avoid embarrassment/condescension

## 9-12 (Ages 14-18)
- Flesch-Kincaid: Grade 9-10
- Academic sentences (20 words)
- Full mathematical vocabulary
- LOW scaffolding
- Professional, direct tone
- Efficiency valued

## College (18+)
- Flesch-Kincaid: Grade 11-12
- Complex sentences OK (25 words)
- Technical/academic language
- MINIMAL scaffolding
- Collegial academic tone
- Mathematical rigor expected
`,

  feedbackGuidelines: `
# Feedback Guidelines Summary

## Core Principles (All Ages)
- Use PROCESS praise ("you worked hard") not PERSON praise ("you're smart")
- Add "yet" to struggles: "You haven't mastered this yet"
- Never say "Not everyone is good at math" - signals low expectations

## By Age:

### K-2
- Visual symbols, audio cues help
- High scaffolding with guiding prompts
- Celebrate small wins enthusiastically
- Phrases: "Great job!" "You got it!" "Let's try together"

### 3-5
- Written feedback appropriate
- Explain WHY answers are correct/incorrect
- Phrases: "Nice work!" "Let's check this." "Your strategy worked"

### 6-8
- Be direct but not harsh
- Acknowledge what they DID right first
- Peer-conscious - avoid embarrassment
- Phrases: "Your approach was solid." "The error is in step 3."

### 9-12
- Efficiency over explanation
- Reference specific concepts
- Phrases: "Correct." "Error: check the signs." "Review [concept]."

### College
- Academic precision
- Reference theorems by name
- Phrases: "Correct." "The error occurs in..." (or nothing for correct)
`,

  vocabularyGuidelines: `
# Math Vocabulary Guidelines

## K-2 Vocabulary
- add, subtract, plus, minus, equal
- more, less, bigger, smaller
- count, number, total
- circle, square, triangle
- Use: "put together" for addition, "take away" for subtraction

## 3-5 Vocabulary
- multiply, divide, product, quotient
- fraction, numerator, denominator, decimal
- perimeter, area, angle
- equation, solve, pattern

## 6-8 Vocabulary
- variable, coefficient, expression, equation
- ratio, proportion, percent
- integer, exponent, slope
- Pythagorean theorem, probability

## 9-12 Vocabulary
- polynomial, quadratic, function
- domain, range, asymptote
- sine, cosine, tangent
- derivative, limit (pre-calc/calc)

## College Vocabulary
- Full technical vocabulary
- Reference theorems by name
- Mathematical notation expected
`,

  toneTemplates: `
# Tone Templates by Grade

## K-2 Correct Answer
"Great job! You got it right!
Here's what you did: [simple steps]
Keep up the good work!"

## K-2 Incorrect Answer
"Good try! Let's look at this together.
[Simple step-by-step explanation]
You'll get it next time!"

## 3-5 Correct Answer
"Nice work! You got the right answer.
Your Solution: [numbered steps]
Great problem-solving!"

## 3-5 Incorrect Answer
"Good effort! Let's check this together.
[Step-by-step with WHERE the error was]
Remember: [key concept]"

## 6-8 Correct Answer
"Correct. Good work.
[Brief solution verification]
Solid reasoning."

## 6-8 Incorrect Answer
"Not quite. Let's review this.
[Solution with error identification]
Watch for this next time."

## 9-12 Correct Answer
"Correct.
[Minimal verification, maybe alternative approach]"

## 9-12 Incorrect Answer
"Incorrect. Error in [specific location].
[Correct solution]
Review [specific concept]."

## College Correct
"Correct. [Optional: alternative approach]"

## College Incorrect
"Incorrect.
[Precise solution with proper notation]
Error: [specific identification]"
`,
};

/**
 * Teaching Methodology RAG Content
 * Comprehensive guidelines for each math teaching methodology
 */
const METHODOLOGY_RAG_CONTENT: Record<TeachingMethodology, string> = {
  'standard': `
# Standard (Balanced) Math Instruction

## Overview
A balanced approach combining conceptual understanding with procedural fluency.
Uses the best elements from multiple methodologies to provide clear, effective explanations.

## Key Principles
1. EXPLAIN THE WHY - Help students understand why procedures work
2. SHOW THE HOW - Demonstrate step-by-step procedures clearly
3. PRACTICE - Reinforce with examples
4. CONNECT - Link to prior knowledge and real-world applications

## Explanation Structure
1. State what we're solving
2. Show the mathematical steps with brief reasoning
3. Verify the answer
4. Summarize the key concept

## Language Style
- Clear, direct explanations
- Use standard mathematical terminology appropriate for grade level
- Balance between conceptual explanation and procedural steps
`,

  'singapore': `
# Singapore Math / Bar Model Method

## Overview
Based on Jerome Bruner's Concrete-Pictorial-Abstract (CPA) approach.
Students move from physical manipulatives to visual models to abstract notation.
Heavy emphasis on visualization, number bonds, and bar models (tape diagrams).

## Key Principles
1. CONCRETE → PICTORIAL → ABSTRACT progression
2. VISUALIZATION over counting - see quantities as groups
3. NUMBER BONDS - show part-whole relationships
4. BAR MODELS - draw rectangles to represent quantities
5. MENTAL MATH strategies - breaking numbers apart

## Explanation Techniques

### Number Bonds
- Show how numbers can be "broken apart" into parts
- Example: 8 can be broken into 5 and 3 (number bond)
- "8 is made of 5 and 3" or "5 and 3 make 8"

### Bar Models (Tape Diagrams)
For word problems, ALWAYS describe drawing a bar model:
- "Let's draw a bar to show this"
- "Draw one long bar for the total"
- "Split the bar into parts for what we know and don't know"
- "The unknown part is what we're finding"

### Addition/Subtraction Bar Model Pattern:
- Part + Part = Whole
- Whole - Part = Other Part
- "Draw a bar. The whole bar is [total]. One part is [known]. The other part is what we need to find."

### Multiplication Bar Model Pattern:
- Draw multiple equal bars or one bar divided into equal parts
- "Each unit represents [amount]. We have [number] units."

### Mental Math Strategies
- Make a 10: "To add 8 + 5, think: 8 + 2 = 10, then 10 + 3 = 13"
- Breaking apart: "24 × 3 = (20 × 3) + (4 × 3) = 60 + 12 = 72"
- Compensation: "To subtract 99, subtract 100 then add 1 back"

## Language Style
- "Let's visualize this" / "Picture this"
- "Draw a bar model" / "Sketch a number bond"
- "Break apart the number" / "Make a 10 first"
- "See how the parts make the whole"
- Reference concrete objects before abstract: "Imagine 8 apples..."

## Example Explanation (Addition)
"Let's solve 47 + 38.
First, let's use a mental math strategy - make a friendly number!
47 + 38... think of 38 as 40 - 2.
47 + 40 = 87 (adding a round number is easier!)
87 - 2 = 85 (now take away the extra 2)
So 47 + 38 = 85"
`,

  'traditional': `
# Traditional / Direct Instruction Method

## Overview
Explicit, teacher-led instruction focusing on standard algorithms.
Emphasizes procedural fluency, memorization of facts, and efficient calculation.
Based on proven methods used for generations.

## Key Principles
1. DIRECT INSTRUCTION - Teacher demonstrates, student replicates
2. STANDARD ALGORITHMS - Use established procedures (not multiple strategies)
3. MEMORIZATION - Math facts should be memorized for automaticity
4. PRACTICE - Drill and repetition build fluency
5. SEQUENTIAL - Master one skill before moving to the next

## Explanation Techniques

### Standard Algorithm Focus
- Show THE standard algorithm, not multiple approaches
- "Here's how to solve this properly"
- Present steps in the traditional order
- Emphasize correct procedure and notation

### Long Division (Traditional Method)
1. Divide
2. Multiply
3. Subtract
4. Bring down
5. Repeat

### Long Multiplication (Traditional Method)
- Multiply by ones digit, write result
- Multiply by tens digit, shift left (or add zero), write result
- Add partial products

### Fraction Operations
- For addition/subtraction: Find common denominator, add/subtract numerators
- For multiplication: Multiply numerators, multiply denominators, simplify
- For division: "Invert and multiply" (multiply by reciprocal)

## Language Style
- Direct and efficient: "Do this, then this, then this"
- "The correct method is..."
- "Follow these steps exactly"
- "Remember the rule: [state rule]"
- Use mathematical terms formally
- Avoid lengthy conceptual explanations - focus on procedure

## Example Explanation (Division)
"To divide 847 ÷ 3:
Step 1: 3 goes into 8 twice (2). Write 2 above the 8.
Step 2: 2 × 3 = 6. Write 6 under 8.
Step 3: 8 - 6 = 2. Bring down the 4 to make 24.
Step 4: 3 goes into 24 eight times (8). Write 8 above the 4.
Step 5: 8 × 3 = 24. 24 - 24 = 0. Bring down the 7.
Step 6: 3 goes into 7 twice (2). Write 2 above the 7.
Step 7: 2 × 3 = 6. 7 - 6 = 1 remainder.
Answer: 847 ÷ 3 = 282 R1"
`,

  'common-core': `
# Common Core Standards Math

## Overview
Balances conceptual understanding with procedural fluency.
Emphasizes mathematical reasoning, multiple representations, and real-world connections.
Students should understand WHY procedures work, not just HOW.

## Key Principles
1. CONCEPTUAL UNDERSTANDING - Understand why, not just how
2. PROCEDURAL FLUENCY - Skill in carrying out procedures
3. STRATEGIC COMPETENCE - Ability to formulate and solve problems
4. ADAPTIVE REASONING - Capacity for logical thought and reflection
5. PRODUCTIVE DISPOSITION - See math as sensible and useful

## Required Strategies & Models

### Number Bonds (Part-Part-Whole)
- Show relationships between parts and whole
- Triangle or circle diagrams connecting numbers
- "The whole is made up of these parts"

### Tape Diagrams
- Rectangular bars representing quantities
- Show comparison, part-whole, multiplication/division
- "Draw a tape diagram to represent this problem"

### Arrays
- For multiplication, show rows and columns
- "3 × 4 means 3 rows of 4"

### Number Lines
- Show operations as movements on a line
- "Start at 25, jump forward 18 to land on 43"

### Place Value Strategies
- Decompose numbers by place value
- "45 + 38 = (40 + 30) + (5 + 8) = 70 + 13 = 83"

### Properties of Operations
- Commutative: a + b = b + a
- Associative: (a + b) + c = a + (b + c)
- Distributive: a(b + c) = ab + ac
- "We can rearrange because of the commutative property"

## Language Style
- "Let's think about what's really happening here"
- "There are several ways to approach this"
- "Why does this method work?"
- "How can we represent this visually?"
- "What does this mean in the real world?"
- Reference properties by name

## Example Explanation (Multiplication)
"To solve 6 × 14, let's use the distributive property.
Break 14 into 10 + 4.
6 × 14 = 6 × (10 + 4)
       = (6 × 10) + (6 × 4)    [Distributive property]
       = 60 + 24
       = 84
This works because multiplying 6 by 14 is the same as
multiplying 6 by 10 and 6 by 4, then adding the results."
`,

  'montessori': `
# Montessori Math Method

## Overview
Hands-on, self-paced learning using concrete manipulatives.
Children work with physical materials before abstract symbols.
Emphasizes sensory experience and self-discovery.

## Key Principles
1. CONCRETE TO ABSTRACT - Physical materials first, symbols later
2. HANDS-ON LEARNING - "Learning by doing"
3. SELF-PACED - Each child progresses at their own rate
4. ISOLATION OF DIFFICULTY - Focus on one concept at a time
5. AUTO-CORRECTION - Materials allow self-checking

## Montessori Materials to Reference

### Golden Beads (Decimal System)
- Unit beads (1s), Ten bars (10s), Hundred squares (100s), Thousand cubes (1000s)
- "Imagine laying out the beads..."
- "Picture exchanging 10 unit beads for one ten bar"

### Bead Chains
- For skip counting and multiplication
- "Think of counting along the bead chain..."

### Stamp Game
- Color-coded stamps for place value operations
- Green (units), Blue (tens), Red (hundreds)

### Number Rods
- Red and blue segmented rods for quantities 1-10
- "Like measuring with the number rods..."

### Fraction Circles/Squares
- Physical pieces showing fractions
- "Imagine the fraction circle divided into parts..."

## Explanation Techniques
- Reference physical materials the child might know
- Describe actions: "pick up," "exchange," "combine," "separate"
- Use sensory language: "feel," "see," "touch," "count"
- Connect to concrete experiences

## Language Style
- "Imagine you have the materials in front of you"
- "Picture yourself working with the beads"
- "If you laid out the golden beads, you would see..."
- "Exchange ten units for one ten bar"
- "Combine the quantities" / "Separate into groups"
- Warm, patient, non-judgmental tone

## Example Explanation (Subtraction with Regrouping)
"Let's solve 42 - 17 using the golden beads.
Start with 42: that's 4 ten-bars and 2 unit beads.
We need to take away 17 (1 ten-bar and 7 units).
Look at the units: we have 2, but need to take away 7.
We don't have enough units! Let's exchange.
Take 1 ten-bar and exchange it for 10 unit beads.
Now we have: 3 ten-bars and 12 unit beads (still 42!).
Take away 7 units: 12 - 7 = 5 units remain.
Take away 1 ten-bar: 3 - 1 = 2 ten-bars remain.
Answer: 2 ten-bars and 5 units = 25"
`,

  'saxon': `
# Saxon Math Method

## Overview
Incremental development with continual spiral review.
New concepts introduced in small steps, previously learned concepts constantly reviewed.
Emphasizes consistent practice and cumulative learning.

## Key Principles
1. INCREMENTAL - Small, manageable learning steps
2. SPIRAL REVIEW - Constantly revisit previous concepts
3. DISTRIBUTED PRACTICE - Practice spread over time, not massed
4. CUMULATIVE - Every problem set includes old and new material
5. AUTOMATICITY - Build speed and accuracy through repetition

## Explanation Techniques

### Connect to Prior Learning
- "Remember when we learned about [previous concept]? This builds on that."
- "This is similar to what you did last week with..."
- "You already know how to [related skill], so..."

### Step-by-Step Consistency
- Always use the same procedure format
- Number steps clearly (Step 1, Step 2, etc.)
- Use consistent terminology across explanations

### Fact Fluency
- Reference memorized facts as foundations
- "Since you know 6 × 7 = 42, you can use that here"
- Assume basic facts are memorized

### Incremental Building
- Connect new concept to the simpler version
- "You know how to add two-digit numbers. Now we'll do three-digit."
- Build complexity gradually

## Language Style
- "This is just like [simpler problem], with one more step"
- "Remember the rule: [state rule consistently]"
- "You've practiced this before"
- "Let's add one new piece to what you know"
- Clear, consistent, methodical
- Reference facts: "6 × 7 is 42, so..."

## Example Explanation (Building on Prior Knowledge)
"Solving 3.4 × 2.1:
You already know how to multiply whole numbers (like 34 × 21).
This is the same process with one extra step at the end!

Step 1: Ignore the decimals. Multiply 34 × 21.
   34 × 21 = 714 (You've practiced this!)

Step 2: Count decimal places in original numbers.
   3.4 has 1 decimal place. 2.1 has 1 decimal place.
   Total: 2 decimal places.

Step 3: Put 2 decimal places in your answer.
   714 → 7.14

Answer: 3.4 × 2.1 = 7.14

You'll keep practicing this until it's automatic!"
`,

  'classical': `
# Classical Education Math Method

## Overview
Based on the Trivium (grammar, logic, rhetoric) and Quadrivium (arithmetic, geometry, music, astronomy).
Emphasizes mastery of fundamentals, logical reasoning, and interconnected learning.
Math seen as training for the mind and path to understanding universal truths.

## Key Principles
1. MASTERY BEFORE ADVANCEMENT - Complete fluency in basics first
2. LOGICAL REASONING - Emphasize the "why" through logic
3. INTERCONNECTION - Show how concepts relate to each other
4. BEAUTY IN MATH - Math as discovery of truth and beauty
5. CLASSICAL METHODS - Time-tested approaches and algorithms

## Three Stages Aligned to Trivium

### Grammar Stage (K-4): Facts and Fundamentals
- Memorize math facts through songs, chants, repetition
- Learn the "grammar" of mathematics
- Drill basic operations until automatic
- "These are the building blocks you need to know"

### Logic Stage (5-8): Understanding Relationships
- Ask "why" questions
- Prove why algorithms work
- Connect concepts logically
- "Let's think about WHY this rule works"

### Rhetoric Stage (9-12): Application and Expression
- Apply knowledge to complex problems
- Explain mathematical reasoning clearly
- See math's connection to other subjects
- "Now demonstrate your understanding"

## Explanation Techniques

### Logical Argumentation
- "If A, then B. Since A is true, B must be true."
- Use clear logical connections
- Show cause and effect in mathematical steps

### Connect to Fundamentals
- Reference basic facts as building blocks
- "This rests on your knowledge that..."
- "From our foundation in [basic concept]..."

### Proof and Verification
- Show WHY the answer is correct
- Verify through alternate methods when possible
- "We can check this by..."

## Language Style
- "Therefore" / "Thus" / "It follows that"
- "Since we know... we can conclude..."
- "This is true because..."
- "Let us reason through this"
- Formal but not cold
- Emphasize logical connections

## Example Explanation (Logical Development)
"Let's solve the equation 2x + 5 = 13.

Our goal is to find the value of x (isolate x).

Reasoning:
If 2x + 5 = 13, then we need to remove the 5 from the left side.
Since 5 was added to 2x, we must subtract 5 to remove it.
We subtract from both sides to keep the equation balanced (what we do to one side, we must do to the other).

2x + 5 - 5 = 13 - 5
2x = 8

Now, since x is multiplied by 2, we divide by 2 to find x.
2x ÷ 2 = 8 ÷ 2
x = 4

Verification: Let's check. If x = 4, then 2(4) + 5 = 8 + 5 = 13. ✓
Our reasoning was sound. Therefore, x = 4."
`,

  'waldorf': `
# Waldorf / Steiner Math Method

## Overview
Integrates math with movement, art, and storytelling.
Learning follows child's developmental stages (7-year cycles).
Math is experienced through rhythm, beauty, and connection to nature.

## Key Principles
1. MOVEMENT INTEGRATION - Learn through body movement
2. ARTISTIC ELEMENT - Draw, paint, and create with math
3. STORYTELLING - Introduce concepts through stories
4. RHYTHM AND PATTERN - Use clapping, walking, recitation
5. DEVELOPMENTAL STAGES - Match instruction to child's age
6. MAIN LESSON BLOCKS - Immerse in one subject at a time

## Teaching Through Stories
- Math concepts introduced through fairy tales or nature stories
- Numbers have "personalities" or characteristics
- "Once upon a time, there were 4 acorns..."
- Create vivid mental images

## Movement Integration
- Reference physical activities: clapping, stepping, jumping
- "Imagine stepping along a number line"
- "Clap the pattern: 3, 6, 9, 12..."
- Bean bag counting, walking multiplication tables

## Artistic Connection
- Describe drawing or visual beauty in math
- Form drawing - geometric patterns
- "Draw a beautiful spiral as you count"
- Reference symmetry, patterns, forms in nature

## Nature Connections
- Use natural objects and phenomena
- Seasons, growth patterns, flower petals
- "Just like the 5 petals on an apple blossom..."
- Connect to the living world

## Explanation Techniques

### Story-Based Introduction
- Frame problems in narrative context
- "Imagine a farmer with his sheep..."
- Create a picture in the child's mind

### Rhythmic Practice
- Reference counting patterns and rhythms
- "Feel the rhythm: 5, 10, 15, 20..."
- Patterns and repetition with beauty

### Visual/Artistic Language
- "Picture this in your mind"
- "See the beautiful pattern"
- "Draw the problem to understand it"

## Language Style
- Warm, imaginative, descriptive
- "Picture in your mind..."
- "Imagine..." / "See how..."
- Reference nature: "like branches on a tree"
- "Feel the rhythm of the numbers"
- Avoid cold, mechanical language
- Create wonder and beauty

## Example Explanation (Multiplication through Story)
"Let's discover 4 × 6.

Imagine a garden with 4 rows of flowers.
In each row, 6 beautiful flowers are blooming.
Picture walking through the garden, row by row.

Row 1: 6 flowers (6)
Row 2: 6 more flowers (6 + 6 = 12)
Row 3: 6 more flowers (12 + 6 = 18)
Row 4: 6 more flowers (18 + 6 = 24)

Walking through all 4 rows, counting each precious flower,
you discover there are 24 flowers in your garden!

4 × 6 = 24

Feel the pattern: 6, 12, 18, 24...
Like the rhythm of seasons, the numbers grow in a beautiful pattern."
`,
};

/**
 * Get the teaching methodology RAG content
 */
export function getMethodologyPrompt(methodology: TeachingMethodology): string {
  return METHODOLOGY_RAG_CONTENT[methodology] || METHODOLOGY_RAG_CONTENT['standard'];
}

/**
 * Get the combined RAG context for a specific grade band
 */
export function getRAGContext(gradeBand: GradeBand, methodology: TeachingMethodology = 'standard'): string {
  return `
=== GRADE LEVEL CONTEXT ===
Target Grade Band: ${gradeBand} (${GRADE_BAND_LABELS[gradeBand]})

=== TEACHING METHODOLOGY ===
${METHODOLOGY_LABELS[methodology]}
${METHODOLOGY_RAG_CONTENT[methodology]}

=== GRADE-LEVEL GUIDELINES ===
${RAG_CONTENT.gradeBands}

${RAG_CONTENT.feedbackGuidelines}

${RAG_CONTENT.vocabularyGuidelines}

${RAG_CONTENT.toneTemplates}

=== IMPORTANT INSTRUCTIONS ===
Generate explanations appropriate for ${gradeBand} students using the ${METHODOLOGY_LABELS[methodology]} methodology:
- Use vocabulary from the ${gradeBand} list (and below)
- Match the sentence complexity for ${gradeBand}
- Use the tone and phrases from the ${gradeBand} templates
- Apply the scaffolding level appropriate for ${gradeBand}
- Follow the specific techniques and language style from the ${METHODOLOGY_LABELS[methodology]} guidelines
`;
}

/**
 * Get a condensed prompt addition for the grade level and methodology
 */
export function getGradeLevelPrompt(gradeLevel: GradeLevel, methodology: TeachingMethodology = 'standard'): string {
  const band = getGradeBand(gradeLevel);

  const bandInstructions: Record<GradeBand, string> = {
    'K-2': `
AUDIENCE: Kindergarten through 2nd grade students (ages 5-8)
LANGUAGE: Use very simple words. Short sentences (5-8 words max). Say "take away" not "subtract."
TONE: Warm, enthusiastic, encouraging. Use phrases like "Great job!" and "You got it!"
STRUCTURE: Number each step. One idea per line. Include encouraging words between steps.
MATH TERMS: Only use: add, plus, minus, take away, equal, more, less, count, number`,

    '3-5': `
AUDIENCE: 3rd through 5th grade students (ages 8-11)
LANGUAGE: Grade-appropriate vocabulary. Sentences up to 12-15 words.
TONE: Encouraging but clear. Use phrases like "Nice work!" and "Let's check this."
STRUCTURE: Numbered steps with brief explanations. Show the math alongside words.
MATH TERMS: Can use: multiply, divide, fraction, decimal, equation, perimeter, area`,

    '6-8': `
AUDIENCE: 6th through 8th grade students (ages 11-14)
LANGUAGE: Standard math terminology. Sentences up to 15-18 words.
TONE: Respectful and direct. Avoid sounding condescending. Use phrases like "Good work" and "Let's review."
STRUCTURE: Clear steps with mathematical reasoning. Use "because" and "therefore."
MATH TERMS: Use proper terms: variable, equation, coefficient, ratio, proportion, exponent`,

    '9-12': `
AUDIENCE: High school students (ages 14-18)
LANGUAGE: Full mathematical vocabulary. Academic sentences OK.
TONE: Professional and direct. Minimal praise needed. Focus on the math.
STRUCTURE: Concise steps with notation. Skip obvious substeps.
MATH TERMS: Use: polynomial, quadratic, function, domain, range, derivative, integral`,

    'college': `
AUDIENCE: College/university students (ages 18+)
LANGUAGE: Technical academic language. Full mathematical notation.
TONE: Collegial and precise. Skip unnecessary encouragement.
STRUCTURE: Proof-style or calculation-style as appropriate. Reference theorems by name.
MATH TERMS: Full technical vocabulary. LaTeX notation acceptable.`,
  };

  // Combine grade-level instructions with methodology-specific guidance
  const methodologyGuidance = METHODOLOGY_RAG_CONTENT[methodology] || METHODOLOGY_RAG_CONTENT['standard'];

  return `${bandInstructions[band]}

=== TEACHING METHODOLOGY: ${METHODOLOGY_LABELS[methodology]} ===
${methodologyGuidance}`;
}
