# Misoltav Language Design Specification
**Version 2.0 — Revised Syntax Edition**

> *Misoltav is a beginner-friendly smart contract language. It reads like plain text, uses indentation instead of braces, requires no type declarations, and has built-in safety keywords. If you can read it, you can write it.*

---

## Table of Contents

1. [Language Motivation & Philosophy](#1-language-motivation--philosophy)
2. [Key Features](#2-key-features)
3. [Language Architecture](#3-language-architecture)
4. [BNF Grammar](#4-bnf-grammar)
5. [EBNF Grammar](#5-ebnf-grammar)
6. [Syntax Comparison: Misoltav vs Solidity](#6-syntax-comparison-misoltav-vs-solidity)
7. [Built-in Keywords & Context Variables](#7-built-in-keywords--context-variables)
8. [Built-in Safety Mechanisms](#8-built-in-safety-mechanisms)
9. [Full Language Examples](#9-full-language-examples)
10. [Use Case Catalogue](#10-use-case-catalogue)
11. [Compiler Pipeline](#11-compiler-pipeline)
12. [Roadmap](#12-roadmap)

---

## 1. Language Motivation & Philosophy

Solidity is powerful but steep. Its C-style braces, type declarations on every variable, and cryptic modifiers push beginners away. Misoltav asks: *what is the simplest possible syntax that can still write safe, real smart contracts?*

The answer is indentation, plain keywords, and smart defaults.

**Three core principles:**

| Principle | What it means |
|-----------|---------------|
| **Readable by anyone** | A non-programmer should understand the intent of a contract |
| **Safe by default** | Access control, overflow protection, and reentrancy guards are built in as keywords |
| **Less boilerplate** | No semicolons, no braces, no type annotations required for basic contracts |

---

## 2. Key Features

### 2.1 Indentation-Based Blocks
Like Python, block structure is defined by indentation (4 spaces or 1 tab). No `{}` needed.

```misoltav
function withdraw(amount):
    require balance[sender] >= amount
    balance[sender] -= amount
```

### 2.2 No Required Type Annotations
Variables and parameters are untyped by default. The compiler infers types from usage and context.

```misoltav
owner = sender          -- owner holds an address
balance[address]        -- balance is a mapping: address → number
count = 0               -- count is a number
```

### 2.3 Built-in `sender`, `value`, `now`, `self`
No `msg.sender` — just `sender`. No `block.timestamp` — just `now`. These read like plain English.

### 2.4 `only` Keyword for Access Control
```misoltav
function mint(user, amount):
    only owner          -- reverts if sender != owner
    balance[user] += amount
```

### 2.5 `require` Without Parentheses
```misoltav
require balance[sender] >= amount
require sender == owner
```

### 2.6 Mapping Declaration by Subscript
```misoltav
balance[address]        -- declares a mapping: address → number
approved[address][address]  -- nested mapping: address → address → bool
```

### 2.7 Events with `emit`
```misoltav
event Transfer(from, to, amount)

emit Transfer(from: sender, to: user, amount: amount)
```

### 2.8 `payable` Functions
```misoltav
function deposit():
    payable
    balance[sender] += value
```

### 2.9 Pattern Matching with `match`
```misoltav
match status:
    Active:
        -- handle active
    Paused:
        -- handle paused
```

### 2.10 Guard Keyword `lock` for Reentrancy
```misoltav
function withdraw(amount):
    lock                -- reentrancy guard
    require balance[sender] >= amount
    balance[sender] -= amount
    send(sender, amount)
```

### 2.11 Struct Declarations
```misoltav
struct Proposal:
    id
    description
    votes
    executed
```

### 2.12 Enum Declarations
```misoltav
enum Status:
    Active
    Paused
    Closed
```

### 2.13 Interfaces
```misoltav
interface IToken:
    function transfer(to, amount)
    function balanceOf(user)
```

---

## 3. Language Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                  Misoltav Source File (.miso)                    │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  LEXER                                                           │
│  · Tokenises keywords, identifiers, numbers, strings            │
│  · Tracks indentation levels to produce INDENT / DEDENT tokens  │
└──────────────┬───────────────────────────────────────────────────┘
               │ Token Stream
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  PARSER                                                          │
│  · Recursive-descent, indentation-aware                         │
│  · Builds Abstract Syntax Tree (AST)                            │
│  · Human-readable parse errors with line/column pointers        │
└──────────────┬───────────────────────────────────────────────────┘
               │ AST
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  SEMANTIC ANALYSER                                               │
│  · Type inference (no annotation required)                      │
│  · Scope and symbol resolution                                  │
│  · `only` access-control checker                                │
│  · `lock` reentrancy graph                                      │
│  · Overflow / underflow detector                                │
└──────────────┬───────────────────────────────────────────────────┘
               │ Typed AST
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  IR GENERATOR  (Misoltav Intermediate Representation — MIR)      │
└──────────────┬───────────────────────────────────────────────────┘
               │ MIR
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  EVM BACKEND                                                     │
│  · Emits EVM bytecode                                           │
│  · Generates ABI JSON automatically                             │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 File Extension
`.miso`

### 3.2 Indentation Rules
- Use **4 spaces** or **1 tab** per indentation level (consistent within a file)
- Mixed indentation is a compile-time error
- Block starts after every `:` at end of a line

### 3.3 Standard Library (`std`)

| Package | Contents |
|---------|----------|
| `std.tokens` | ERC-20, ERC-721, ERC-1155 base contracts |
| `std.access` | Ownable, Roles, Pausable |
| `std.math`   | Safe math, fixed-point |
| `std.crypto` | hash, keccak256, ecrecover |

---

## 4. BNF Grammar

```bnf
<program>         ::= { <import-stmt> } { <top-level-decl> }

<import-stmt>     ::= "import" IDENTIFIER
                    | "import" IDENTIFIER "from" STRING

<top-level-decl>  ::= <contract-decl>
                    | <interface-decl>
                    | <struct-decl>
                    | <enum-decl>

<contract-decl>   ::= "contract" IDENTIFIER NEWLINE INDENT
                        <contract-body>
                      DEDENT

<contract-body>   ::= { <state-decl> | <event-decl> | <fn-decl> }

<state-decl>      ::= IDENTIFIER "=" <expression> NEWLINE
                    | IDENTIFIER "[" IDENTIFIER "]" NEWLINE
                    | IDENTIFIER "[" IDENTIFIER "]" "[" IDENTIFIER "]" NEWLINE

<event-decl>      ::= "event" IDENTIFIER "(" <id-list-opt> ")" NEWLINE

<fn-decl>         ::= "function" IDENTIFIER "(" <param-list-opt> ")" ":" NEWLINE
                        INDENT <fn-body> DEDENT

<fn-body>         ::= { <guard-stmt> | <statement> }

<guard-stmt>      ::= "only" <expression> NEWLINE
                    | "lock" NEWLINE
                    | "payable" NEWLINE

<interface-decl>  ::= "interface" IDENTIFIER ":" NEWLINE
                        INDENT { <fn-signature> } DEDENT

<fn-signature>    ::= "function" IDENTIFIER "(" <param-list-opt> ")" NEWLINE

<struct-decl>     ::= "struct" IDENTIFIER ":" NEWLINE
                        INDENT { IDENTIFIER NEWLINE } DEDENT

<enum-decl>       ::= "enum" IDENTIFIER ":" NEWLINE
                        INDENT { IDENTIFIER NEWLINE } DEDENT

<param-list-opt>  ::= <param-list> | ε
<param-list>      ::= IDENTIFIER { "," IDENTIFIER }

<id-list-opt>     ::= IDENTIFIER { "," IDENTIFIER } | ε

<statement>       ::= <assign-stmt>
                    | <aug-assign-stmt>
                    | <if-stmt>
                    | <match-stmt>
                    | <for-stmt>
                    | <while-stmt>
                    | <return-stmt>
                    | <emit-stmt>
                    | <require-stmt>
                    | <revert-stmt>
                    | <send-stmt>
                    | <expr-stmt>

<assign-stmt>     ::= <lvalue> "=" <expression> NEWLINE

<aug-assign-stmt> ::= <lvalue> "+=" <expression> NEWLINE
                    | <lvalue> "-=" <expression> NEWLINE
                    | <lvalue> "*=" <expression> NEWLINE
                    | <lvalue> "/=" <expression> NEWLINE

<lvalue>          ::= IDENTIFIER
                    | IDENTIFIER "[" <expression> "]"
                    | IDENTIFIER "[" <expression> "]" "[" <expression> "]"
                    | IDENTIFIER "." IDENTIFIER

<if-stmt>         ::= "if" <expression> ":" NEWLINE INDENT <stmt-list> DEDENT
                       { "elif" <expression> ":" NEWLINE INDENT <stmt-list> DEDENT }
                       [ "else" ":" NEWLINE INDENT <stmt-list> DEDENT ]

<match-stmt>      ::= "match" <expression> ":" NEWLINE
                        INDENT { <match-arm> } DEDENT

<match-arm>       ::= IDENTIFIER ":" NEWLINE INDENT <stmt-list> DEDENT

<for-stmt>        ::= "for" IDENTIFIER "in" <expression> ":" NEWLINE
                        INDENT <stmt-list> DEDENT

<while-stmt>      ::= "while" <expression> ":" NEWLINE
                        INDENT <stmt-list> DEDENT

<return-stmt>     ::= "return" [ <expression> ] NEWLINE

<emit-stmt>       ::= "emit" IDENTIFIER "(" <named-arg-list-opt> ")" NEWLINE

<require-stmt>    ::= "require" <expression> NEWLINE
                    | "require" <expression> "," STRING NEWLINE

<revert-stmt>     ::= "revert" STRING NEWLINE

<send-stmt>       ::= "send" "(" <expression> "," <expression> ")" NEWLINE

<expr-stmt>       ::= <expression> NEWLINE

<stmt-list>       ::= { <statement> }

<named-arg-list-opt> ::= <named-arg> { "," <named-arg> } | ε
<named-arg>          ::= IDENTIFIER ":" <expression>

<expression>      ::= <or-expr>
<or-expr>         ::= <and-expr> { "or" <and-expr> }
<and-expr>        ::= <not-expr> { "and" <not-expr> }
<not-expr>        ::= [ "not" ] <cmp-expr>
<cmp-expr>        ::= <add-expr> { <cmp-op> <add-expr> }
<cmp-op>          ::= "==" | "!=" | "<" | ">" | "<=" | ">="
<add-expr>        ::= <mul-expr> { ( "+" | "-" ) <mul-expr> }
<mul-expr>        ::= <unary-expr> { ( "*" | "/" | "%" ) <unary-expr> }
<unary-expr>      ::= [ "-" ] <postfix-expr>
<postfix-expr>    ::= <primary> { <subscript> | <attribute> | <call> }
<subscript>       ::= "[" <expression> "]"
<attribute>       ::= "." IDENTIFIER
<call>            ::= "(" [ <arg-list> ] ")"
<primary>         ::= LITERAL | IDENTIFIER | "(" <expression> ")"

<arg-list>        ::= <expression> { "," <expression> }
LITERAL           ::= NUMBER | STRING | BOOL | ADDRESS | UNIT
NUMBER            ::= [0-9]+
STRING            ::= '"' [^"]* '"'
BOOL              ::= "true" | "false"
ADDRESS           ::= "0x" [0-9a-fA-F]{40}
UNIT              ::= NUMBER ( "ether" | "wei" | "gwei" | "days" | "hours" | "minutes" )
IDENTIFIER        ::= [a-zA-Z_][a-zA-Z0-9_]*
NEWLINE           ::= "\n"
INDENT            ::= (indentation increases)
DEDENT            ::= (indentation decreases)
```

---

## 5. EBNF Grammar

```ebnf
program         = { import-stmt } , { top-level-decl } ;

import-stmt     = "import" , IDENTIFIER , [ "from" , STRING ] ;

top-level-decl  = contract-decl | interface-decl | struct-decl | enum-decl ;

contract-decl   = "contract" , IDENTIFIER , NEWLINE ,
                  INDENT , contract-body , DEDENT ;

contract-body   = { state-decl | event-decl | fn-decl } ;

state-decl      = IDENTIFIER , "=" , expression , NEWLINE
                | IDENTIFIER , "[" , IDENTIFIER , "]"
                  , { "[" , IDENTIFIER , "]" } , NEWLINE ;

event-decl      = "event" , IDENTIFIER ,
                  "(" , [ IDENTIFIER , { "," , IDENTIFIER } ] , ")" , NEWLINE ;

fn-decl         = "function" , IDENTIFIER ,
                  "(" , [ param-list ] , ")" , ":" , NEWLINE ,
                  INDENT , fn-body , DEDENT ;

fn-body         = { guard-stmt | statement } ;

guard-stmt      = ( "only" , expression
                  | "lock"
                  | "payable" ) , NEWLINE ;

param-list      = IDENTIFIER , { "," , IDENTIFIER } ;

interface-decl  = "interface" , IDENTIFIER , ":" , NEWLINE ,
                  INDENT , { fn-signature } , DEDENT ;

fn-signature    = "function" , IDENTIFIER , "(" , [ param-list ] , ")" , NEWLINE ;

struct-decl     = "struct" , IDENTIFIER , ":" , NEWLINE ,
                  INDENT , IDENTIFIER , { NEWLINE , IDENTIFIER } , NEWLINE , DEDENT ;

enum-decl       = "enum" , IDENTIFIER , ":" , NEWLINE ,
                  INDENT , IDENTIFIER , { NEWLINE , IDENTIFIER } , NEWLINE , DEDENT ;

statement       = assign-stmt   | aug-assign-stmt | if-stmt
                | match-stmt    | for-stmt         | while-stmt
                | return-stmt   | emit-stmt        | require-stmt
                | revert-stmt   | send-stmt        | expr-stmt ;

assign-stmt     = lvalue , "=" , expression , NEWLINE ;

aug-assign-stmt = lvalue , ( "+=" | "-=" | "*=" | "/=" ) , expression , NEWLINE ;

lvalue          = IDENTIFIER
                | IDENTIFIER , { "[" , expression , "]" }
                | IDENTIFIER , "." , IDENTIFIER ;

if-stmt         = "if" , expression , ":" , NEWLINE ,
                  INDENT , { statement } , DEDENT ,
                  { "elif" , expression , ":" , NEWLINE , INDENT , { statement } , DEDENT } ,
                  [ "else" , ":" , NEWLINE , INDENT , { statement } , DEDENT ] ;

match-stmt      = "match" , expression , ":" , NEWLINE ,
                  INDENT , { match-arm } , DEDENT ;

match-arm       = IDENTIFIER , ":" , NEWLINE , INDENT , { statement } , DEDENT ;

for-stmt        = "for" , IDENTIFIER , "in" , expression , ":" , NEWLINE ,
                  INDENT , { statement } , DEDENT ;

while-stmt      = "while" , expression , ":" , NEWLINE ,
                  INDENT , { statement } , DEDENT ;

return-stmt     = "return" , [ expression ] , NEWLINE ;

emit-stmt       = "emit" , IDENTIFIER , "(" ,
                  [ IDENTIFIER , ":" , expression , { "," , IDENTIFIER , ":" , expression } ] ,
                  ")" , NEWLINE ;

require-stmt    = "require" , expression , [ "," , STRING ] , NEWLINE ;

revert-stmt     = "revert" , STRING , NEWLINE ;

send-stmt       = "send" , "(" , expression , "," , expression , ")" , NEWLINE ;

expr-stmt       = expression , NEWLINE ;

expression      = or-expr ;
or-expr         = and-expr , { "or" , and-expr } ;
and-expr        = not-expr , { "and" , not-expr } ;
not-expr        = [ "not" ] , cmp-expr ;
cmp-expr        = add-expr , { cmp-op , add-expr } ;
cmp-op          = "==" | "!=" | "<" | ">" | "<=" | ">=" ;
add-expr        = mul-expr , { ( "+" | "-" ) , mul-expr } ;
mul-expr        = unary-expr , { ( "*" | "/" | "%" ) , unary-expr } ;
unary-expr      = [ "-" ] , postfix-expr ;
postfix-expr    = primary , { "[" , expression , "]" | "." , IDENTIFIER
                             | "(" , [ arg-list ] , ")" } ;
primary         = LITERAL | IDENTIFIER | "(" , expression , ")" ;
arg-list        = expression , { "," , expression } ;
```

---

## 6. Syntax Comparison: Misoltav vs Solidity

### 6.1 Contract & State Variables

**Solidity**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Token {
    address public owner;
    mapping(address => uint256) public balance;
}
```

**Misoltav**
```misoltav
contract Token
    owner = sender
    balance[address]
```

> No pragma. No `{}`. No types. `sender` assigns the deployer address automatically. `balance[address]` declares a mapping in one line.

---

### 6.2 Minting (Owner-Only Function)

**Solidity**
```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}

function mint(address user, uint256 amount) public onlyOwner {
    balance[user] += amount;
}
```

**Misoltav**
```misoltav
function mint(user, amount):
    only owner
    balance[user] += amount
```

> `only owner` is a one-word access control guard. No modifier definition needed. No semicolons.

---

### 6.3 Transfer Function

**Solidity**
```solidity
function transfer(address to, uint256 amount) public {
    require(balance[msg.sender] >= amount, "Insufficient balance");
    balance[msg.sender] -= amount;
    balance[to] += amount;
}
```

**Misoltav**
```misoltav
function transfer(to, amount):
    require balance[sender] >= amount
    balance[sender] -= amount
    balance[to] += amount
```

> `require` has no parentheses. `sender` replaces `msg.sender`. No type annotations.

---

### 6.4 Events

**Solidity**
```solidity
event Transfer(address indexed from, address indexed to, uint256 amount);

emit Transfer(msg.sender, to, amount);
```

**Misoltav**
```misoltav
event Transfer(from, to, amount)

emit Transfer(from: sender, to: to, amount: amount)
```

> No `indexed` keyword — handled automatically. Named emit arguments prevent argument-order bugs.

---

### 6.5 Payable Functions

**Solidity**
```solidity
function deposit() public payable {
    balance[msg.sender] += msg.value;
}
```

**Misoltav**
```misoltav
function deposit():
    payable
    balance[sender] += value
```

> `payable` is a guard keyword inside the function body. `value` replaces `msg.value`.

---

### 6.6 Reentrancy Protection

**Solidity**
```solidity
bool private locked;
modifier nonReentrant() {
    require(!locked);
    locked = true;
    _;
    locked = false;
}

function withdraw(uint256 amount) public nonReentrant {
    require(balance[msg.sender] >= amount);
    balance[msg.sender] -= amount;
    payable(msg.sender).transfer(amount);
}
```

**Misoltav**
```misoltav
function withdraw(amount):
    lock
    require balance[sender] >= amount
    balance[sender] -= amount
    send(sender, amount)
```

> `lock` is a single keyword that injects a full reentrancy guard. `send(to, amount)` replaces `.transfer()`.

---

### 6.7 If / Else

**Solidity**
```solidity
if (balance[msg.sender] > 0) {
    // ...
} else {
    // ...
}
```

**Misoltav**
```misoltav
if balance[sender] > 0:
    -- ...
else:
    -- ...
```

---

### 6.8 For Loop

**Solidity**
```solidity
for (uint256 i = 0; i < users.length; i++) {
    balance[users[i]] = 0;
}
```

**Misoltav**
```misoltav
for user in users:
    balance[user] = 0
```

---

### 6.9 Match / Pattern Matching

**Solidity** (no native match)
```solidity
if (status == Status.Active) { ... }
else if (status == Status.Paused) { ... }
else { ... }
```

**Misoltav**
```misoltav
match status:
    Active:
        -- handle active
    Paused:
        -- handle paused
    Closed:
        -- handle closed
```

---

### 6.10 Struct

**Solidity**
```solidity
struct Proposal {
    uint256 id;
    string description;
    uint256 votes;
    bool executed;
}
```

**Misoltav**
```misoltav
struct Proposal:
    id
    description
    votes
    executed
```

---

### 6.11 Special Variable Reference

| Concept | Solidity | Misoltav |
|---------|----------|----------|
| Caller address | `msg.sender` | `sender` |
| ETH sent | `msg.value` | `value` |
| Timestamp | `block.timestamp` | `now` |
| Block number | `block.number` | `block` |
| Contract address | `address(this)` | `self` |
| Chain ID | `block.chainid` | `chain` |
| Gas remaining | `gasleft()` | `gas` |

---

## 7. Built-in Keywords & Context Variables

### 7.1 Guard Keywords (inside function body)

| Keyword | Meaning |
|---------|---------|
| `only <expr>` | Reverts if `sender != expr` |
| `lock` | Reentrancy guard (mutex) |
| `payable` | Function accepts ETH; otherwise ETH is rejected |

### 7.2 Context Variables (always available)

| Variable | Value |
|----------|-------|
| `sender` | Address that called this function |
| `value` | Amount of ETH sent with the call |
| `now` | Current block timestamp (Unix seconds) |
| `block` | Current block number |
| `self` | This contract's own address |
| `chain` | Chain ID |
| `gas` | Remaining gas |

### 7.3 Built-in Functions

| Function | Meaning |
|----------|---------|
| `send(to, amount)` | Transfer ETH to address |
| `hash(data)` | keccak256 hash |
| `assert(cond)` | Assert invariant (panics on failure) |
| `require(cond)` | Require condition or revert |
| `revert(msg)` | Revert with message |
| `emit Event(...)` | Emit an event |
| `len(arr)` | Length of array or map |

### 7.4 Unit Literals

```misoltav
1 ether
100 wei
50 gwei
7 days
24 hours
60 minutes
30 seconds
```

### 7.5 Comments

```misoltav
-- This is a single-line comment

--[
  This is a
  multi-line comment
]--

--- This is a doc comment shown in generated documentation
function transfer(to, amount):
    ...
```

---

## 8. Built-in Safety Mechanisms

### 8.1 Overflow / Underflow Protection
All arithmetic is automatically safe. Integer overflow reverts the transaction.

```misoltav
-- This will revert if balance goes negative (no manual check needed)
balance[sender] -= amount
```

### 8.2 `only` Access Guard
```misoltav
function setOwner(newOwner):
    only owner          -- built-in: reverts if sender != owner
    owner = newOwner
```

You can `only` against any value:
```misoltav
only owner              -- sender must equal owner variable
only admin              -- sender must equal admin variable
only self               -- only the contract itself can call
```

### 8.3 `lock` Reentrancy Guard
```misoltav
function withdraw(amount):
    lock                -- automatically sets and clears mutex
    require balance[sender] >= amount
    balance[sender] -= amount
    send(sender, amount)
```

### 8.4 `payable` Guard
If a function does NOT have `payable`, it automatically reverts any call that sends ETH.

```misoltav
function transfer(to, amount):
    -- no `payable` here → sending ETH to this call reverts
    balance[sender] -= amount
    balance[to] += amount
```

### 8.5 Uninitialised Mapping Safety
Mappings always default to zero / empty address for unset keys. No null pointer errors.

---

## 9. Full Language Examples

### 9.1 Hello World

```misoltav
contract HelloWorld
    greeting = "Hello, Misoltav!"

    function getGreeting():
        return greeting
```

---

### 9.2 Token Contract (ERC-20 Style)

```misoltav
contract Token
    owner   = sender
    name    = "MisoToken"
    symbol  = "MISO"
    supply  = 0

    balance[address]
    allowance[address][address]

    event Transfer(from, to, amount)
    event Approval(owner, spender, amount)

    function mint(user, amount):
        only owner
        balance[user] += amount
        supply += amount
        emit Transfer(from: self, to: user, amount: amount)

    function transfer(to, amount):
        require balance[sender] >= amount
        balance[sender] -= amount
        balance[to] += amount
        emit Transfer(from: sender, to: to, amount: amount)

    function approve(spender, amount):
        allowance[sender][spender] = amount
        emit Approval(owner: sender, spender: spender, amount: amount)

    function transferFrom(from, to, amount):
        require allowance[from][sender] >= amount
        require balance[from] >= amount
        allowance[from][sender] -= amount
        balance[from] -= amount
        balance[to] += amount
        emit Transfer(from: from, to: to, amount: amount)

    function burn(amount):
        require balance[sender] >= amount
        balance[sender] -= amount
        supply -= amount
        emit Transfer(from: sender, to: self, amount: amount)
```

---

### 9.3 Voting Contract

```misoltav
contract Voting
    admin = sender
    proposals[address]
    votes[address]
    hasVoted[address]
    count = 0

    event Voted(voter, proposal)

    struct Proposal:
        id
        description
        voteCount

    function addProposal(description):
        only admin
        proposals[count] = Proposal(id: count, description: description, voteCount: 0)
        count += 1

    function vote(proposalId):
        require not hasVoted[sender], "Already voted"
        require proposalId < count, "Invalid proposal"
        proposals[proposalId].voteCount += 1
        hasVoted[sender] = true
        emit Voted(voter: sender, proposal: proposalId)

    function getVoteCount(proposalId):
        return proposals[proposalId].voteCount
```

---

### 9.4 Crowdfunding Contract

```misoltav
contract Crowdfunding
    admin    = sender
    goal     = 0
    deadline = 0
    raised   = 0

    enum Status:
        Active
        Successful
        Failed

    status    = Status.Active
    backers[address]

    event Contributed(backer, amount)
    event Refunded(backer, amount)
    event GoalReached(total)

    function init(goalAmount, durationDays):
        only admin
        goal     = goalAmount
        deadline = now + durationDays * 1 days

    function contribute():
        payable
        require now < deadline, "Campaign ended"
        require status == Status.Active, "Campaign not active"
        backers[sender] += value
        raised += value
        emit Contributed(backer: sender, amount: value)
        if raised >= goal:
            status = Status.Successful
            emit GoalReached(total: raised)

    function withdraw():
        lock
        only admin
        require status == Status.Successful, "Goal not met"
        send(admin, raised)
        raised = 0

    function refund():
        lock
        require now >= deadline, "Too early"
        require status != Status.Successful, "Goal was met"
        amount = backers[sender]
        require amount > 0, "Nothing to refund"
        backers[sender] = 0
        send(sender, amount)
        emit Refunded(backer: sender, amount: amount)
```

---

### 9.5 NFT Contract (ERC-721 Style)

```misoltav
contract SimpleNFT
    admin     = sender
    nextId    = 0

    ownerOf[address]
    tokenURI[address]

    event Minted(to, tokenId, uri)
    event Transferred(from, to, tokenId)

    function mint(to, uri):
        only admin
        tokenId = nextId
        nextId += 1
        ownerOf[tokenId] = to
        tokenURI[tokenId] = uri
        emit Minted(to: to, tokenId: tokenId, uri: uri)

    function transfer(to, tokenId):
        require ownerOf[tokenId] == sender, "Not token owner"
        ownerOf[tokenId] = to
        emit Transferred(from: sender, to: to, tokenId: tokenId)

    function getOwner(tokenId):
        return ownerOf[tokenId]

    function getURI(tokenId):
        return tokenURI[tokenId]
```

---

### 9.6 Escrow Contract

```misoltav
contract Escrow
    buyer  = sender
    seller = 0x0000000000000000000000000000000000000000
    amount = 0

    enum State:
        Awaiting
        Complete
        Refunded

    state = State.Awaiting

    event Released(to, amount)
    event Refunded(to, amount)

    function setSeller(addr):
        only buyer
        seller = addr

    function deposit():
        payable
        only buyer
        require state == State.Awaiting, "Already settled"
        amount = value

    function release():
        lock
        only buyer
        require state == State.Awaiting, "Already settled"
        state = State.Complete
        send(seller, amount)
        emit Released(to: seller, amount: amount)

    function refundBuyer():
        lock
        only seller
        require state == State.Awaiting, "Already settled"
        state = State.Refunded
        send(buyer, amount)
        emit Refunded(to: buyer, amount: amount)
```

---

## 10. Use Case Catalogue

| Use Case | Key Contracts | Misoltav Features Used |
|----------|--------------|------------------------|
| **Fungible Token** | `Token` | `balance[address]`, `only`, events |
| **NFT Collection** | `SimpleNFT` | `ownerOf[address]`, struct, events |
| **Crowdfunding** | `Crowdfunding` | `payable`, `enum`, `lock`, time units |
| **DAO Voting** | `Voting` | struct, `hasVoted[address]`, `only` |
| **Escrow** | `Escrow` | `lock`, enum state machine, `only` |
| **Multi-sig Wallet** | `MultiSig` | `approved[address][address]`, threshold |
| **Staking Pool** | `StakingPool` | time arithmetic, `send`, `lock` |
| **Land Registry** | `LandRegistry` | struct, `ownerOf[address]`, events |
| **Lottery** | `Lottery` | `payable`, `send`, array of players |
| **Supply Chain** | `SupplyChain` | enum stages, `only`, event audit trail |

---

## 11. Compiler Pipeline

### 11.1 Stages

```
Source (.miso)
    │
    ▼
[1] Lexer          → Tokens + INDENT/DEDENT tokens
    │
    ▼
[2] Parser         → Abstract Syntax Tree (AST)
    │
    ▼
[3] Name Resolver  → Symbol table, scope checking
    │
    ▼
[4] Type Inferrer  → Inferred types for all nodes
    │
    ▼
[5] Safety Passes  → only / lock / payable / overflow checks
    │
    ▼
[6] IR Lowering    → Misoltav IR (MIR)
    │
    ▼
[7] Optimiser      → Constant folding, dead-code removal
    │
    ▼
[8] Code Generator → EVM bytecode + ABI JSON
```

### 11.2 Error Message Style

```
Error [E012]: access control violation
  --> Token.miso:8:5
   |
 8 |     balance[user] += amount
   |     ^^^^^^^^^^^^^^^^^^^^^^^
   |     This function modifies state but has no `only` guard.
   |     Anyone can call this and mint tokens to themselves.
   |
   = help: Add `only owner` as the first line of this function.
```

### 11.3 CLI Tool (`misolc`)

```sh
misolc compile MyContract.miso     # compile to bytecode
misolc check   MyContract.miso     # type-check and safety-check only
misolc abi     MyContract.miso     # output ABI JSON
misolc test    ./tests/            # run test suite
misolc fmt     MyContract.miso     # auto-format
misolc docs    MyContract.miso     # generate HTML docs from --- comments
```

---

## 12. Roadmap

| Phase | Milestone | Status |
|-------|-----------|--------|
| 1 | Language specification (this document) | ✅ Done |
| 2 | Lexer + Indentation tokeniser (Rust) | 🔲 Planned |
| 3 | Recursive-descent parser | 🔲 Planned |
| 4 | Type inference engine | 🔲 Planned |
| 5 | Safety pass (only / lock / payable) | 🔲 Planned |
| 6 | EVM bytecode backend | 🔲 Planned |
| 7 | Standard library (`std.tokens`, `std.access`) | 🔲 Planned |
| 8 | `misolc test` framework | 🔲 Planned |
| 9 | LSP server (IDE autocomplete) | 🔲 Planned |
| 10 | Browser playground | 🔲 Planned |

---

## Appendix A — Reserved Keywords

```
contract  interface  struct    enum      function  import
from      return     emit      require   revert    send
if        elif       else      match     for       in
while     only       lock      payable   and       or
not       true       false     self
```

## Appendix B — Built-in Context Variables

```
sender   value   now   block   self   chain   gas
```

## Appendix C — Operator Precedence (Highest to Lowest)

| Level | Operators | Associativity |
|-------|-----------|---------------|
| 6 | `-` (unary) | Right |
| 5 | `*` `/` `%` | Left |
| 4 | `+` `-` | Left |
| 3 | `<` `>` `<=` `>=` `==` `!=` | Left |
| 2 | `not` | Right |
| 1 | `and` | Left |
| 0 | `or` | Left |

---

## Solidity parity and production use

Misoltav is designed to achieve **full Solidity feature parity** via the **transpile path**: every construct in this spec is parseable and transpiles to valid Solidity, so you can compile with **solc** or **Foundry** and deploy to mainnet.

| Area | Status |
|------|--------|
| **Control flow** | `if` / `elif` / `else`, `match`, `for`, `while` → emitted as Solidity equivalents |
| **Types** | Structs, enums, mappings with `address` or `number`/`uint` keys, array-like `name[]` |
| **Contracts** | Inheritance (`contract A is B, C`), `abstract contract`, `constructor`, `receive()`, `fallback()` |
| **Interfaces** | Top-level `interface Name:` with function signatures |
| **Errors** | `error Name(args);` and `revert Name(...)` |
| **Imports** | `import X` / `import X from "path"` (emitted as Solidity `import` or inlined for single-file) |

**How to use in production**

1. Write `.miso` contracts; use `misolc check <file.miso>` to verify parse and basic checks.
2. Transpile: `misolc transpile <file.miso> -o out.sol`.
3. Compile with Foundry/Hardhat: `forge build` or `npx hardhat compile`.
4. Deploy and test as usual. Native `misolc compile` produces EVM bytecode + ABI for simpler contracts; for full feature set, use the transpile path.

---

## Safety (only / lock / payable and overflow)

- **only &lt;id&gt;** enforces access control: the function body runs only if `sender == id`. Emitted as a modifier (e.g. `onlyOwner`).
- **lock** prevents reentrancy: a single reentrancy guard is emitted and applied to the function.
- **payable** allows the function to receive ether; emitted as Solidity `payable`.
- **Overflow**: Transpiled Solidity uses **Solidity 0.8+**, which has built-in overflow checks. Native compile assumes the same semantics where applicable.

---

*Misoltav Language Specification v2.0*
*Authored: 2026*
*License: Apache 2.0*
