export interface ProgrammingFoundationsLesson {
  title: string;
  durationMinutes: number;
  isFree?: boolean;
  content: string;
}

export interface ProgrammingFoundationsModule {
  title: string;
  description: string;
  lessons: ProgrammingFoundationsLesson[];
}

export const programmingFoundationsCourse = {
  title: "Functional Programming Foundations",
  slug: "functional-programming-foundations",
  shortDescription:
    "A comprehensive five-day beginner programme covering data, decisions, collections, functions, errors, algorithms and complete program design.",
  description: `Learn programming from first principles without assuming any previous coding experience.

This five-day candidate course uses plain English, relatable analogies, worked examples, guided exercises and two complete design projects. You will learn how data flows through a program, how functions transform it, and why functional programming keeps variables immutable and side effects at the edges.

The learning path follows the supplied Candidate Edition handbook. Each day contains concept lessons, guided practice, a knowledge check and independent work. By the end, you will be able to design a complete program from input through processing to output, explain your decisions, anticipate common errors and test the result.

Recommended pace: five intensive learning days plus orientation and final assessment—approximately 38 hours in total. Self-paced learners may complete one module per week.`,
  requirements: [
    "No previous programming experience is required",
    "A notebook or digital note-taking tool",
    "Time to complete the guided exercises and final assessment",
    "Curiosity and a willingness to solve problems step by step",
  ],
  whatYouLearn: [
    "Recognise and use numbers, text, booleans, lists and missing values",
    "Create clear immutable variables and choose appropriate operators",
    "Separate value-producing expressions from side-effecting statements",
    "Build conditions and decision trees for multi-path business rules",
    "Use loops, lists, records and nested data structures",
    "Design reusable functions with parameters, return values and safe scope",
    "Identify syntax, runtime, logic and type errors",
    "Keep input and output at the edges of a functional program",
    "Explain and apply search, maximum and simple sorting algorithms",
    "Design, test and review a complete program from a real-world brief",
  ],
  sessions: [
    {
      title: "October 2026 Intensive Cohort",
      description:
        "A facilitator-led two-week cohort combining clear concept teaching, guided workbook exercises, collaborative problem-solving, capstone preparation and final assessment support.",
      startDatetime: "2026-10-19T09:00:00+01:00",
      endDatetime: "2026-10-30T17:00:00+00:00",
      capacity: 10,
      venueAddress: "Royal Victoria Dock, 1 Western Gateway",
      venueCity: "London",
      venuePostcode: "E16 1XL",
    },
    {
      title: "November 2026 Intensive Cohort",
      description:
        "A facilitator-led two-week cohort combining clear concept teaching, guided workbook exercises, collaborative problem-solving, capstone preparation and final assessment support.",
      startDatetime: "2026-11-19T09:00:00+00:00",
      endDatetime: "2026-11-30T17:00:00+00:00",
      capacity: 10,
      venueAddress: "Royal Victoria Dock, 1 Western Gateway",
      venueCity: "London",
      venuePostcode: "E16 1XL",
    },
  ],
  modules: [
    {
      title: "Start Here — Course Orientation & 5-Day Plan",
      description:
        "Understand the course method, the functional programming golden rule and the recommended five-day learning timeline.",
      lessons: [
        {
          title: "Welcome, outcomes and how to use this course",
          durationMinutes: 30,
          isFree: true,
          content: `LEARNING GOAL
Understand what you will be able to design by the end of the programme and how each day builds toward the final assessment.

COURSE JOURNEY
Day 1 — Data, variables and operators
Day 2 — Expressions, statements and conditions
Day 3 — Loops, lists and data structures
Day 4 — Functions, scope and errors
Day 5 — Input/output, algorithms and complete program design
Final assessment — Discount ticket booking system

HOW TO STUDY
Complete the lessons in order. Read the examples, write your answers before revealing or discussing a solution, and keep a learning journal. Most concept days require 5–6 hours; allow additional time for the Day 5 capstone and final assessment. If studying part-time, use one module per week.

You do not need to write executable code. The handbook deliberately begins with plain-English logic and pseudocode so that you understand the ideas before learning language-specific syntax.`,
        },
        {
          title: "The functional programming golden rule",
          durationMinutes: 35,
          isFree: true,
          content: `CORE IDEA
Everything is data flowing through functions. Variables never change. Expressions do the work. Statements stay at the edges.

FIVE GOLDEN RULES
1. Variables are immutable: create a new value instead of erasing an old one.
2. Use expressions for logic because expressions produce values.
3. Use statements only where the program receives input or produces output.
4. Keep functions pure: the same input should produce the same output.
5. Push side effects—printing, saving, sending or updating—to the edges.

PROGRAM SHAPE
Input (statement) → Process (expressions and functions) → Output (statement)

KEY INSIGHT
Programming is data going in, functions transforming it, and useful data coming out. Use this model throughout the course to classify every operation you encounter.`,
        },
        {
          title: "Prepare your learning workspace",
          durationMinutes: 25,
          content: `MATERIALS
- Notebook or paper
- Pen or pencil
- Index cards for data and function activities
- Sticky notes for decision trees and program flows

SETUP ACTIVITY
Create five sections in your notes—one per course day—and a sixth section for the final assessment. Add a glossary page where you record unfamiliar terms in your own words.

BASELINE REFLECTION
Choose an everyday process such as making breakfast or travelling to work. Write its inputs, the decisions made, repeated actions and final outputs. You will revisit this example as your programming vocabulary grows.`,
        },
      ],
    },
    {
      title: "Day 1 — Data, Variables & Operators",
      description:
        "Identify the five basic data types, create immutable variables, perform operations and diagnose type errors.",
      lessons: [
        {
          title: "The five basic data types",
          durationMinutes: 55,
          content: `OBJECTIVES
Recognise numbers, text, booleans, lists and missing values, and select the correct type for real-world information.

NUMBER
Whole numbers and decimals such as 5, 3.14, -10 and 0. Use numbers for age, price, temperature and scores. Arithmetic operations include +, -, *, / and remainder (%).

TEXT / STRING
Letters, words or sentences written in quotes, such as "Hello" or "123". The quoted value "123" is text, not a number. Text can be combined, measured and converted between upper and lower case.

BOOLEAN
Exactly true or false—a light switch with two states. Use booleans for questions such as isStudent, hasPaid or didPass.

LIST / ARRAY
An ordered collection such as [1, 2, 3] or ["milk", "eggs"]. Lists can be empty and are normally kept to one item type.

NOTHING
null or undefined represents a missing, empty or not-yet-known value.

CHECK YOURSELF
Classify: 42, "42", false, [false, true], null and []. Explain what evidence led to each answer.`,
        },
        {
          title: "Variables and immutability",
          durationMinutes: 45,
          content: `A variable is a clear name that points to a value:

age = 25
name = "John"
isStudent = true
scores = [85, 90, 78]

LOCKER ANALOGY
A locker number points to the locker's contents. In the same way, a variable name lets you refer to a value without repeating the value everywhere.

IMMUTABILITY
In functional programming, an existing variable is not overwritten.

Avoid: age = 25, then age = 26
Prefer: age = 25, then newAge = 26

Keeping both values preserves history, makes behaviour predictable and lets you trace how data was transformed. Bank statements use this principle: a transaction produces a new balance rather than erasing the previous balance.

PRACTICE
Name variables for a person's name, active status, basket items, price and city. Then represent a change by creating a new variable rather than replacing the first.`,
        },
        {
          title: "Arithmetic, comparison, logical, text and list operators",
          durationMinutes: 65,
          content: `Operators are actions performed on data.

ARITHMETIC
+ add, - subtract, * multiply, / divide, % remainder.
Example: 17 % 5 produces 2.

COMPARISON
>, <, >=, <=, === and != compare values and produce a boolean. Prefer strict equality (===), which checks both value and type: 5 === "5" is false.

LOGICAL
AND requires both conditions to be true. OR requires at least one. NOT reverses a boolean.
Example: isStudent AND hasID controls a student discount.

TEXT
Use + to combine text and .length to count characters.
"Hello" + " " + "World" produces "Hello World".

LISTS
Combine lists, count items and access an item by position. [1, 2, 3][0] produces 1.

GUIDED PRACTICE
Evaluate: 5 + 3 * 2; 15 % 4; "Apple".length > 3; 10 === "10"; NOT (true AND false). Record the type as well as the result.`,
        },
        {
          title: "Type errors and safe operations",
          durationMinutes: 40,
          content: `A type error occurs when an operation does not make sense for the supplied data.

COMMON EXAMPLES
- "Hello" * 3: text has no mathematical value.
- 5 + true: a number and boolean should not be added.
- [1, 2] + 3: a list and a single number are different structures.
- 10 / 0: division by zero is undefined.

TYPE COERCION
Some languages allow "5" + 3 and produce "53" because text takes over. A result is produced, but it may not be the result intended. Do not mix types unless the conversion is explicit and understood.

DEBUGGING ROUTINE
1. Identify every value's type.
2. Identify what type the operator expects.
3. Convert or replace the mismatched value deliberately.
4. Test normal, boundary and missing values.`,
        },
        {
          title: "Day 1 workshop — sort, calculate and map data",
          durationMinutes: 90,
          content: `EXERCISE 1 — SORT THE VALUES
Place 5, "Hello", true, [1,2,3], null, 3.14, "John", false, undefined, -10 and "123" into Number, Text, Boolean, List or Nothing groups.

EXERCISE 2 — IMMUTABLE LOCKERS
Create well-named variables for "John", true, [1,2,3], 100 and "London". Represent new values "Jane", false, [1,2,3,4], 90 and "Paris" without overwriting the originals.

EXERCISE 3 — CALCULATOR GAME
Evaluate the expressions from the previous lesson by hand. State operator precedence, result and result type.

EXERCISE 4 — STUDENT DATA MAP
Design the data for a student system containing names, ages, grade lists, pass status and sometimes missing grades. For each data type, name variables and list two or three valid operations.

SUCCESS CRITERIA
Every value has an intentional type, variable names communicate meaning, and no existing value is mutated.`,
        },
        {
          title: "Day 1 review, quiz and homework",
          durationMinutes: 45,
          content: `KEY TAKEAWAYS
1. The basic types are Number, Text, Boolean, List and Nothing.
2. Variables are names pointing to values; functional variables remain immutable.
3. Operators add, compare, combine or transform compatible data.
4. Type errors appear when an operation receives unsuitable data.

QUIZ
What are the five data types? What is a variable? What does immutable mean? Which operator combines text? What creates a type error?

HOMEWORK
Choose a daily process such as making coffee, commuting or cooking dinner. Identify its data types, name the variables and list the operations performed. Preserve each stage as a new value instead of describing an overwrite.`,
        },
      ],
    },
    {
      title: "Day 2 — Expressions, Statements & Conditions",
      description:
        "Separate logic from side effects, create boolean conditions and turn business rules into decision trees.",
      lessons: [
        {
          title: "Expressions: questions that produce values",
          durationMinutes: 45,
          content: `An expression always produces a value. It asks a question without changing the outside world.

EXAMPLES
2 + 2 → 4
"Hello" + " World" → "Hello World"
10 > 5 → true
[1,2,3][0] → 1

CHARACTERISTICS
- Every expression returns something useful.
- It has no side effect.
- The same input produces the same result.

Think of asking “What is the capital of France?” The answer is “Paris”; nothing else changes. Expressions are the preferred building blocks for program logic because they can be combined, tested and reasoned about.`,
        },
        {
          title: "Statements and side effects",
          durationMinutes: 45,
          content: `A statement is a command that performs an action: print a message, save a file, send an email or update an external system.

Unlike an expression, a statement does not primarily provide a reusable value. It changes something outside the calculation, so it may depend on external state and be less predictable.

FUNCTIONAL PROGRAMMING RULE
Keep calculations as expressions and use statements only at the input/output edges.

GOOD FLOW
total = price * quantity
discount = total * 0.1
finalPrice = total - discount
Print finalPrice

The first three lines calculate values. Only the final line changes the outside world. This separation makes the logic easy to test without printing, saving or sending anything.`,
        },
        {
          title: "Conditions and boolean paths",
          durationMinutes: 55,
          content: `A condition lets a program select a path from boolean data.

IF age >= 18 THEN "Adult"
ELSE "Child"

PROCESS
1. Evaluate an expression that produces true or false.
2. Follow the true path or false path.
3. For more outcomes, chain conditions in a deliberate order.

MULTIPLE CONDITIONS
Scores can map to grades using ordered thresholds. Check the highest threshold first so a score over 90 does not get captured by a lower rule.

COMPOUND CONDITIONS
Use AND when every requirement is mandatory: isStudent AND hasID.
Use OR when either condition is sufficient: isWeekend OR isHoliday.

Keep the decision itself an expression. Printing the chosen result remains an output statement.`,
        },
        {
          title: "Decision trees for complex rules",
          durationMinutes: 55,
          content: `A decision tree displays every possible route through conditional logic.

METHOD
1. Put the first condition at the top.
2. Draw YES and NO branches.
3. Add another condition where a branch needs further decisions.
4. Continue until each route reaches a final outcome.

ORDER MATTERS
For ticket pricing, check age under 12, then age 65 or over, then adult student status, before returning the regular price. Each person should reach one unambiguous result.

REVIEW QUESTIONS
- Does every condition produce a boolean?
- Are boundary values such as 12, 18 and 65 handled?
- Can any input reach two conflicting outcomes?
- Is there a default path for values that match no special rule?`,
        },
        {
          title: "Day 2 workshop — cinema pricing decision system",
          durationMinutes: 100,
          content: `PART 1 — CLASSIFY
Mark each action as expression or statement: add two values, print a greeting, calculate circle area, save a file, test 10 > 5, send an email and measure text length.

PART 2 — REFACTOR
Rewrite a discount calculation so that total, discount and final price are expressions and printing is the only final statement.

PART 3 — DRAW DECISION TREES
Create trees for voting eligibility, letter grades and temperature labels (Hot, Warm, Cool, Cold).

PART 4 — CINEMA PRICING
Rules: regular $10; student $8 when age is at least 18 and ID is present; child $5 under 12; senior $7 at age 65 or above.

Define the variables and types, order the conditions, calculate the price as expressions and use one output statement. Test ages 11, 12, 18, 64 and 65 plus missing student ID.`,
        },
        {
          title: "Day 2 review, quiz and homework",
          durationMinutes: 40,
          content: `KEY TAKEAWAYS
Expressions produce values; statements perform actions; conditions select paths; decision trees expose every route; functional design pushes statements to the edges.

QUIZ
Define expression, statement and condition. Explain the functional rule for logic versus side effects. Describe how to build and validate a decision tree.

HOMEWORK
Choose a decision you make daily, such as what to wear or what to eat. Draw all possible branches, include boundary cases and ensure every possible input reaches an outcome.`,
        },
      ],
    },
    {
      title: "Day 3 — Loops, Lists & Data Structures",
      description:
        "Repeat operations safely and organise related information with lists, records and nested structures.",
      lessons: [
        {
          title: "FOR EACH, WHILE and REPEAT loops",
          durationMinutes: 60,
          content: `Loops repeat instructions without duplicating them.

FOR EACH
Use when every item in a known list must be processed. Example: for each name, produce a greeting.

WHILE
Use when repetition continues until a boolean condition changes. Example: continue asking while the password is incorrect. The loop must contain a path that can change the condition, or it may never stop.

REPEAT N
Use when the exact repetition count is known, such as three attempts or ten exercises.

CHOOSING A LOOP
Ask whether you have a collection, a stopping condition or an exact count. Then define the data before the loop, the transformation during each iteration and the final value after it.`,
        },
        {
          title: "Lists and zero-based indexing",
          durationMinutes: 45,
          content: `A list is an ordered collection. Positions start at zero.

For [10, 20, 30, 40, 50]:
- list[0] is 10
- list[1] is 20
- list[list.length - 1] is 50

COMMON OPERATIONS
.length counts items; [index] retrieves an item; + combines lists; membership checks determine whether an item exists.

BOUNDARY SAFETY
An empty list has no first or last item. An index equal to the list length is already outside the list. Check list length before retrieving data when emptiness is possible.

Prefer lists whose items share a type, because consistent collections are easier to process and validate.`,
        },
        {
          title: "Records, objects and named fields",
          durationMinutes: 45,
          content: `A record—also called an object—groups named fields describing one thing.

person = {
  name: "Alice",
  age: 25,
  city: "London",
  isStudent: true,
  scores: [85, 90, 78]
}

Access fields with person.name or person["age"].

LIST VERSUS RECORD
A list is ordered by numbered position and normally holds similar items. A record uses meaningful labels and can combine different types. Use a list for many scores; use a record for one student's name, age and scores.`,
        },
        {
          title: "Nested data structures",
          durationMinutes: 55,
          content: `Real programs combine lists and records.

A class can be a list of student records. Each student record can contain a list of grades. An order can contain customer information plus a list of item records with name, price and quantity.

READING NESTED DATA
students[0].name retrieves the first student's name.
students[2].grades[0] retrieves the first grade belonging to the third student.

DESIGN METHOD
1. Identify the real-world entities.
2. Use a record for the fields describing one entity.
3. Use a list when there may be many entities.
4. Nest only where the ownership relationship is clear.
5. Trace the access path one level at a time.`,
        },
        {
          title: "Day 3 workshop — shopping cart and class system",
          durationMinutes: 105,
          content: `EXERCISE 1 — SIMULATE LOOPS
Produce greetings for Alice, Bob, Charlie and David using FOR EACH. Double [10,20,30,40,50]. Simulate a password WHILE loop and identify exactly why it stops.

EXERCISE 2 — SHOPPING CART
Use a list of item records priced $1 to $5. Trace each addition and confirm a final total of $15. Then describe a functional alternative that produces a new accumulated value per step.

EXERCISE 3 — STUDENT RECORD
For Alice Johnson with grades [85,92,78,88], total the grades and divide by the list length.

EXERCISE 4 — CLASS MANAGEMENT
For Alice [85,90,78], Bob [55,60,65] and Charlie [92,88,94], calculate each average, determine pass at average >= 60, count passing students and calculate the class average.

Show every intermediate value so another learner can audit the result.`,
        },
        {
          title: "Day 3 review, quiz and homework",
          durationMinutes: 40,
          content: `KEY TAKEAWAYS
Loops repeat work; FOR EACH processes lists; WHILE follows a condition; REPEAT N uses a known count. Lists use numbered positions; records use named fields; nested structures model real systems.

QUIZ
Name the three loop types. Explain list versus record, zero-based indexing, first-item access and record-field access.

HOMEWORK
Choose an app such as Spotify, Instagram or a banking app. Describe at least three data structures it may use. Include one list of records and explain how you would access a nested value.`,
        },
      ],
    },
    {
      title: "Day 4 — Functions, Scope & Errors",
      description:
        "Package reusable logic, control variable visibility, compose functions and diagnose three major error categories.",
      lessons: [
        {
          title: "Functions, parameters and return values",
          durationMinutes: 65,
          content: `A function is a named, reusable block of logic—a recipe written once and used many times.

FOUR PARTS
1. Name: what the function is called.
2. Parameters: the input values it needs.
3. Processing: the transformation it performs.
4. Return: the value it gives back.

EXAMPLES
double(number) returns number * 2.
greet(name) returns "Hello, " + name.
isAdult(age) returns age >= 18.
circleArea(radius) returns 3.14159 * radius * radius.
max(a,b) returns the larger value.

A well-designed function has one clear purpose, descriptive names and predictable output. Test it with typical, boundary and unusual inputs.`,
        },
        {
          title: "Function composition and pipelines",
          durationMinutes: 45,
          content: `Functions can call other functions, and one function's output can become the next function's input.

rectangleVolume can call rectangleArea, then multiply the returned area by depth. A text pipeline might capitalise "hello", add an exclamation mark and reverse the result.

PIPELINE THINKING
input → function A → intermediate value → function B → output

Composition keeps each step small and independently testable. Instead of one function that reads input, transforms it, prints it and saves it, create pure transformation functions and let a thin outer layer manage input/output.`,
        },
        {
          title: "Local, global and parameter scope",
          durationMinutes: 50,
          content: `Scope answers: where does a variable exist and where can it be seen?

LOCAL
Declared inside a function and visible only there. Like belongings in a bedroom, other functions cannot access them directly.

GLOBAL
Declared outside functions and visible broadly. Like a shared kitchen, it can be accessed by many parts of a program—but widespread access increases conflict risk.

PARAMETER
Provided in a function definition and local to that function call.

BEST PRACTICE
Keep values as local as possible. Use parameters to provide dependencies and reserve globals for genuine constants. This reduces hidden connections and makes testing easier.`,
        },
        {
          title: "Syntax, runtime and logic errors",
          durationMinutes: 60,
          content: `SYNTAX ERROR
The program's grammar is invalid, such as 5 + * 3, a missing bracket or unclosed quote. The program cannot start correctly.

RUNTIME ERROR
The syntax is valid, but execution fails: division by zero, missing files, undefined variables or list positions that do not exist.

LOGIC ERROR
The program runs but produces the wrong answer, such as adding width and height for rectangle area. Logic errors are often hardest to find because nothing crashes.

DEBUGGING METHOD
Read the error, reproduce it with the smallest input, classify it, trace intermediate values, correct one cause at a time, and rerun normal plus boundary tests.`,
        },
        {
          title: "Day 4 workshop — reusable checkout functions",
          durationMinutes: 110,
          content: `PART 1 — WRITE FUNCTIONS
Design square, isAdult, max, textLength and sumAll functions. Label each function's name, parameters, processing and return value.

PART 2 — ASSEMBLY LINE
Compose capitalize, addExclamation and reverse beginning with "hello". Trace every intermediate output.

PART 3 — SCOPE GAME
Determine which local, global and parameter values are visible inside several functions. Explain why inaccessible values should fail.

PART 4 — FIX ERRORS
Classify and repair a missing function delimiter, division by zero and a discount function that subtracts $10 instead of 10%.

PART 5 — E-COMMERCE CHECKOUT
Create calculateSubtotal(cart), applyDiscount(subtotal,coupon), addTax(total,taxRate) and calculateTotal(...). Test a $20 book and $5 pen with SAVE10 and 10% tax.`,
        },
        {
          title: "Day 4 review, quiz and homework",
          durationMinutes: 40,
          content: `KEY TAKEAWAYS
Functions package reusable logic through names, parameters, processing and returned values. Local scope limits visibility; globals should be rare. Errors can be syntactic, runtime or logical.

QUIZ
Name the four parts of a function. Contrast local and global scope. Define the three error types and explain why logic errors can be hardest to find.

HOMEWORK
Design functions to calculate triangle area, check whether a number is prime and find the largest number in a list. State parameters, steps, return type and test cases.`,
        },
      ],
    },
    {
      title: "Day 5 — Input, Output, Algorithms & Complete Design",
      description:
        "Connect pure logic to the outside world, apply classic algorithms and design an end-to-end program.",
      lessons: [
        {
          title: "Input and output at the edges",
          durationMinutes: 50,
          content: `Input is data entering a program: keyboard text, clicks, files, APIs or sensors. Output leaves a program: screen content, files, network messages, print or sound.

FUNCTIONAL STRUCTURE
Input statement → pure processing expressions → output statement

Example: receive an age, evaluate age >= 18, then display Adult or Child. Do not combine reading, deciding and outputting into one opaque operation.

SEPARATION BENEFITS
The processing can be tested with prepared values, reused with different input sources and connected to different output destinations without rewriting the core logic.`,
        },
        {
          title: "Algorithm 1 — find the maximum",
          durationMinutes: 45,
          content: `An algorithm is an ordered sequence of instructions that solves a problem.

FIND MAXIMUM
1. Treat the first number as the current maximum.
2. Compare the next number with the current maximum.
3. If the new number is larger, produce a new maximum.
4. Continue until there are no values left.
5. Return the maximum.

TRACE [3,7,2,9,1]
Start 3 → compare 7, max 7 → compare 2, max 7 → compare 9, max 9 → compare 1, max 9.

EDGE CASES
Define what should happen for an empty list, a one-item list, duplicate maxima and all-negative values.`,
        },
        {
          title: "Algorithms 2 and 3 — search and bubble sort",
          durationMinutes: 70,
          content: `SEARCH
Inspect each item in order. Return true immediately when the target matches. If the end is reached without a match, return false.

For ["apple","banana","cherry"] searching for "banana", apple does not match; banana does, so the search stops successfully.

BUBBLE SORT
Compare neighbouring items and swap them when they are out of order. Continue to the end of the list. Repeat passes until a complete pass makes no swaps.

For [5,2,8,1,3], repeated neighbour comparisons eventually produce [1,2,3,5,8].

REFLECTION
Correctness comes before speed for this beginner exercise. Trace each comparison and make the stopping condition explicit.`,
        },
        {
          title: "Complete program architecture",
          durationMinutes: 55,
          content: `A complete functional program has three layers.

INPUT
Statements collect data.

PROCESS
Expressions use immutable variables, data types, operators, conditions, loops, functions and local scope.

OUTPUT
Statements present or persist results.

STUDENT GRADE EXAMPLE
Input a list of student records and scores. For each student, calculate total and average, then produce Pass when average >= 60 or Fail otherwise. Output each student's result and the class average.

DESIGN CHECK
Can the process layer run with fixed test data and no screen, file or network access? If yes, the side effects are likely separated correctly.`,
        },
        {
          title: "Day 5 guided design — grade calculator",
          durationMinutes: 80,
          content: `Design a program that receives student scores, calculates their average and produces Pass at 60 or above, otherwise Fail.

DOCUMENT
1. Data types, including how missing scores are represented.
2. Immutable variables.
3. Arithmetic and comparison expressions.
4. Conditions and their boundary values.
5. Loops used to process scores.
6. calculateAverage and determineResult functions.
7. Local and global scope decisions.
8. Input source and output destination.
9. An eight-step algorithm.

TEST
Use normal passing and failing lists, exactly 60, an empty list and a missing value. Explain the expected behaviour before calculating.`,
        },
        {
          title: "Capstone project — pizza shop program",
          durationMinutes: 130,
          content: `SCENARIO
Design a custom pizza ordering program.

RULES
Base pizza $10; each topping $2; large size adds $5; family adds $10; totals above $30 receive 10% discount; tax is 10% after discount. Inputs are size, topping list and optional SAVE10 or SAVE20 coupon. Output an itemised order summary.

DESIGN DELIVERABLES
- Data types and immutable variables
- Pricing expressions and ordered conditions
- A loop for toppings
- calculateSubtotal, getSizeCost, applyDiscount, applyCoupon and calculateTotal functions
- Local/global scope decisions
- Input and formatted output
- Eleven-step algorithm
- Handling invalid size, empty toppings and invalid coupons

Do not hide calculations. Show subtotal, discounts, tax and final total separately.`,
        },
        {
          title: "Capstone testing and Day 5 review",
          durationMinutes: 70,
          content: `TEST THE PIZZA PROGRAM
1. Small pizza, two toppings, no coupon.
2. Large pizza, three toppings, SAVE10.
3. Family pizza, four toppings and automatic total-over-$30 discount.

For each test, record input, subtotal, each discount, post-discount value, tax, final total and formatted output. Add invalid size, empty topping list and unknown coupon tests.

DAY 5 TAKEAWAYS
Input enters the program; output leaves it; algorithms are explicit solution steps; a complete program follows Input → Process → Output; statements remain at the edges while expressions perform core logic.

QUIZ
Define input, output and algorithm. State the functional I/O rule and name the three classic algorithms studied.`,
        },
      ],
    },
    {
      title: "Final Assessment & Course Reference",
      description:
        "Demonstrate complete program design with the ticket-booking assessment, then consolidate the full vocabulary.",
      lessons: [
        {
          title: "Final assessment — discount ticket booking system",
          durationMinutes: 150,
          content: `DESIGN BRIEF
Create a complete program in plain English. Regular tickets cost $50. Students with ID receive 20% off; seniors aged 65+ receive 15% off; groups of five or more receive 10% off; members receive a free VIP upgrade.

INPUTS
Number of tickets and student, senior and member status.

OUTPUTS
Base price, each discount, final price and VIP upgrade status.

SUBMISSION SECTIONS
1. Data types (10 points)
2. Immutable variables (10)
3. Expressions (10)
4. Decision tree and conditions (10)
5. Loop decision and rationale (5)
6. Six functions, including calculateFinal (15)
7. Scope decisions (10)
8. Input/output design (10)
9. Twelve-step algorithm (10)
10. Error handling (5)
11. Test cases (5)

Total: 100 points. Complete every section before reviewing the supplied expected test outcomes.`,
        },
        {
          title: "Assessment tests and self-review",
          durationMinutes: 70,
          content: `TEST 1
Three tickets, no discounts, no membership. Expected base and final price: $150.

TEST 2
Five tickets, student and member. Expected base $250, student discount $50, group discount $25, VIP upgrade Yes, final $175.

TEST 3
Six tickets, senior, not member. Expected base $300, senior discount $45, group discount $30, VIP No, final $225.

SELF-REVIEW
Award points only when the answer is complete and explained. Check whether discounts are calculated from the intended base, boundary values are covered, variables remain immutable, functions return values and output is separated from processing. Record one strength and one improvement for every assessment section.`,
        },
        {
          title: "Course summary — all fundamentals and glossary",
          durationMinutes: 60,
          content: `CORE FUNDAMENTALS
Variables, data types, operators, expressions, statements, conditions, loops, lists, records/objects, functions, scope, errors, input/output and algorithms.

GOLDEN RULES
Variables never change. Logic uses expressions. Statements are reserved for input/output. Functions remain pure. Side effects stay at the edges.

ESSENTIAL VOCABULARY
Algorithm: ordered problem-solving steps.
Boolean: true or false.
Condition: a decision based on a boolean expression.
Data structure: an organisation of values such as a list or record.
Expression: produces a value.
Function: reusable named logic with parameters and a return value.
Immutable: cannot be changed after creation.
Index: a list position beginning at zero.
Pipeline: one function's output feeding another.
Scope: where a value is visible.
Statement: performs an action.

FINAL REFLECTION
Return to the everyday process you mapped during orientation. Redesign it using typed data, immutable variables, expressions, conditions, appropriate repetition, small functions and explicit input/output.`,
        },
      ],
    },
  ] satisfies ProgrammingFoundationsModule[],
};
