<p align="center">
<img src="assets/logo-black.png" alt="Roundtable Logo" width = '80'>
</p>

<h3 align="center">Roundtable Alias Open Source</h3>

This repo contains code for three open-end quality checks that were part of the original Roundtable Alias API:

* **Categorizations**: Uses OpenAI to label a response as `Valid`, `Profane`, `Off-topic`, `Gibberish`, or `GPT`. The model uses the survey question and response and returns a single word corresponding to the categorization.

* **Effort scores**: Uses OpenAI to rate the response 1 – 10 (0 when the answer is empty). Scores of 4–7 are typical. Lower means minimal effort, and higher signals unusually detailed writing which may be GPT-generated.

* **Duplicate matching**: Uses string-distance methods (Levenshtein distance and longest-common-substring) to identify and group likely duplicates.

  * **Self duplicates** are within the same participant; any length triggers a flag.  
  * **Cross duplicates** compare against other participants' answers to the same question.  
    * If the response is at least 20 characters and passes the distance/LCS thresholds, it is flagged and assigned to the most similar response group.  
    * If a response is less than 20 characters but still matches an existing group, it inherits that group ID without being flagged.  
    * A non-matching answer starts its own group.

---

### Where are the behavioral bot checks?

The open-source package covers only content checks from Alias. Our full behavioral analytics and bot-detection suite (unnatural typing, mouse telemetry, etc.) is available in the new product. You can integrate this in your survey in under 5 minutes. To get started for free, create an account at [accounts.roundtable.ai](https://accounts.roundtable.ai).

## Organization

The entry point is `main.js`: this script validates the payload, cleans the data, and then coordinates the heavy-lift helpers.

* **cross-duplicate-utils.js**: decides which responses need duplicate checks and chunks this into manageable batches. For each batch it fires an async call to **identify-duplicates.js**. Every call is handled by an independent server-side worker (serverless function, background job, etc.), so the string-distance calculations run in true parallel.

* **openai-utils.js**: runs the two OpenAI calls for categorization and effort scoring

* **string-utils.js**: supplies the raw Levenshtein/LCS helpers, **json-utils.js** handles resilient body parsing, and **prompts.js** stores the frozen few-shot prompts.

* **forsta-tracker.js**: Helper script for running Alias on Decipher surveys. Note that if you want to use FingerprintJS, you must replace the Fingerprint link with your account's link.

The overall pattern is that `main.js` orchestrates a set of narrowly focused helpers, and duplicate matching is chunked and executed in parallel workers so a large survey cannot block the rest of the pipeline.

```
├── config.js                 # thresholds / model / timeouts
├── identify-duplicates.js    # server-side endpoint hit by helpers
├── helpers
│   ├── cross-duplicate-utils.js
│   ├── json-utils.js
│   ├── openai-utils.js
│   ├── prompts.js
│   └── string-utils.js
└── main.js                   # Netlify-style handler that orchestrates everything
```

### Quick start

```
git clone <repo>
cd alias-open-source
npm install                     # installs openai, he, sanitize-html, …
export API_SECRET="Bearer sk-…" # your OpenAI key
node main.js                    # or deploy as a Netlify / lambda function
```

## Configuration

### config.js glossary

* **TIMEOUT_MS**: Hard stop (in milliseconds) for the entire Lambda / Netlify-function run.  
  If the handler doesn't return in this time the request is rejected with “Request timed out”.

* **normLevThreshold**: Maximum *normalised* Levenshtein distance (0 – 1). If the distance between two answers is less than or equal to `normLevThreshold`, they count as duplicates.

* **rawLevThreshold**: Maximum *raw* Levenshtein distance (absolute character edits). If the distance is less than or equal to `rawLevThreshold`, the answers count as duplicates (except for ultra-short strings).

* **normLCSThreshold**: Minimum *normalised* longest-common-substring (LCS) ratio (0 – 1). If the ratio is greater than or equal to `normLCSThreshold`, the pair is treated as a duplicate.

* **rawLCSThreshold**: Minimum absolute LCS length (characters). If two answers share at least `rawLCSThreshold` consecutive characters, they are flagged as duplicates.

* **maxBatchSize**: When checking a target answer against other responses, we chunk that list into batches no larger than this before sending them to `identify-duplicates.js`.  

* **openAIModel**: Name of the OpenAI chat model used for quality classification and effort scoring (defaults to `"gpt-4o"`).

### Still to implement

The following helper functions are intentionally left blank as they require integration with your database and server logic. You must complete them before the pipeline will run end-to-end:

* **getGroupValue** (`helpers/cross-duplicate-utils.js`) – returns and increments the next group index for a question when no duplicates are found
* **getOtherResponsesFromSurvey** (`helpers/cross-duplicate-utils.js`) – fetches existing answers for the same survey from your database
* **batchedResponse** (`helpers/cross-duplicate-utils.js`) – POST a chunk of responses to `identify-duplicates.js` and return metrics for each response