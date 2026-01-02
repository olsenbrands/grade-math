# Visual Math Diagrams

## ADDED Requirements

### Requirement: Diagram Generation
The system SHALL generate structured diagram data alongside text explanations when visual representation would aid understanding.

#### Scenario: Explanation with bar model for word problem
- **WHEN** generating explanation for a word problem involving part-whole relationships
- **AND** teaching methodology is Singapore Math or Common Core
- **THEN** the explanation includes a bar-model diagram with type, parts, and textFallback

#### Scenario: Explanation with number line for addition
- **WHEN** generating explanation for an addition or subtraction problem
- **THEN** the explanation MAY include a number-line diagram showing the operation as jumps

#### Scenario: Explanation with fraction visual
- **WHEN** generating explanation for a fraction problem
- **THEN** the explanation MAY include a fraction-visual diagram (circle or strip)

#### Scenario: Explanation with array for multiplication
- **WHEN** generating explanation for a multiplication problem
- **AND** teaching methodology is Traditional or Common Core
- **THEN** the explanation MAY include an array-grid diagram

#### Scenario: No diagram needed
- **WHEN** generating explanation for a problem where visual wouldn't add clarity
- **THEN** the explanation omits the diagram field (null or undefined)

---

### Requirement: Diagram Data Validation
The system SHALL validate all diagram data before rendering to ensure correctness.

#### Scenario: Valid bar-model data
- **WHEN** diagram type is "bar-model"
- **AND** data contains layout, parts array with at least one item, and textFallback
- **THEN** the diagram is considered valid and renders

#### Scenario: Valid number-line data
- **WHEN** diagram type is "number-line"
- **AND** data contains min, max, points array with at least one item, and textFallback
- **AND** min is less than max
- **THEN** the diagram is considered valid and renders

#### Scenario: Valid fraction-visual data
- **WHEN** diagram type is "fraction-visual"
- **AND** data contains type ('circle' or 'strip'), fractions array with at least one item, and textFallback
- **AND** all fractions have numerator and denominator > 0
- **THEN** the diagram is considered valid and renders

#### Scenario: Valid array-grid data
- **WHEN** diagram type is "array-grid"
- **AND** data contains rows > 0, columns > 0, and textFallback
- **THEN** the diagram is considered valid and renders

#### Scenario: Invalid or unsupported diagram type
- **WHEN** diagram type is not one of the supported types
- **OR** required data fields are missing or invalid
- **THEN** the system renders the textFallback instead of the diagram

---

### Requirement: Diagram Rendering
The system SHALL render visual diagrams using SVG components that are responsive and accessible.

#### Scenario: Render bar-model diagram
- **WHEN** displaying a valid bar-model diagram
- **THEN** the system renders an SVG with horizontal bars
- **AND** bars are proportionally sized based on values
- **AND** unknown values display as "?" with visual distinction
- **AND** the SVG has role="img" and aria-label for accessibility

#### Scenario: Render number-line diagram
- **WHEN** displaying a valid number-line diagram
- **THEN** the system renders an SVG with a horizontal line, tick marks, and labeled points
- **AND** jumps are shown as curved arrows with labels
- **AND** the SVG scales to container width

#### Scenario: Render fraction-visual diagram
- **WHEN** displaying a valid fraction-visual diagram with type "circle"
- **THEN** the system renders a circle divided into equal sectors
- **AND** the correct number of sectors are shaded

#### Scenario: Render fraction-visual strip
- **WHEN** displaying a valid fraction-visual diagram with type "strip"
- **THEN** the system renders a horizontal bar divided into equal parts
- **AND** the correct number of parts are shaded

#### Scenario: Render array-grid diagram
- **WHEN** displaying a valid array-grid diagram
- **THEN** the system renders a grid of objects (dots or squares)
- **AND** the grid shows rows × columns arrangement
- **AND** an optional total label is displayed

---

### Requirement: Fallback Behavior
The system SHALL gracefully handle diagram rendering failures by displaying text fallback.

#### Scenario: Text fallback for unsupported type
- **WHEN** diagram type is not in the supported list
- **THEN** the system displays the textFallback in a styled container
- **AND** no error is shown to the user

#### Scenario: Text fallback for render error
- **WHEN** diagram rendering throws an error
- **THEN** the system catches the error
- **AND** displays the textFallback instead
- **AND** logs the error for debugging

#### Scenario: No diagram provided
- **WHEN** explanation has no diagram (null or undefined)
- **THEN** the system displays only the text explanation
- **AND** no fallback container is shown

---

### Requirement: Methodology-Aware Diagram Selection
The system SHALL select appropriate diagram types based on the teaching methodology setting.

#### Scenario: Singapore Math methodology
- **WHEN** teaching methodology is "singapore"
- **AND** problem involves part-whole relationships
- **THEN** the AI prioritizes bar-model diagrams

#### Scenario: Common Core methodology
- **WHEN** teaching methodology is "common-core"
- **THEN** the AI uses bar-model (tape diagrams) for word problems
- **AND** array-grid for multiplication problems

#### Scenario: Traditional methodology
- **WHEN** teaching methodology is "traditional"
- **THEN** the AI uses array-grid for multiplication
- **AND** number-line for integer operations

#### Scenario: Montessori methodology
- **WHEN** teaching methodology is "montessori"
- **THEN** the AI includes rich manipulative descriptions in textFallback
- **AND** uses fraction-visual for fraction problems

---

### Requirement: Responsive Design
The system SHALL render diagrams that work on all screen sizes.

#### Scenario: Desktop display
- **WHEN** diagram is displayed on desktop (>768px width)
- **THEN** the diagram renders at a comfortable viewing size (max-width ~400px)

#### Scenario: Mobile display
- **WHEN** diagram is displayed on mobile (<768px width)
- **THEN** the diagram scales to fit the container width
- **AND** remains legible with appropriate stroke widths

---

### Requirement: Accessibility
The system SHALL ensure diagrams are accessible to users with disabilities.

#### Scenario: Screen reader support
- **WHEN** diagram is rendered
- **THEN** the SVG has role="img" and descriptive aria-label
- **AND** the textFallback is always available

#### Scenario: Color contrast
- **WHEN** diagram uses colors
- **THEN** all colors meet WCAG 2.1 AA contrast requirements (4.5:1 for text)
- **AND** colors are distinguishable in grayscale

#### Scenario: Dark mode support
- **WHEN** user has dark mode enabled
- **THEN** diagram colors adapt appropriately
- **AND** stroke colors invert for visibility
