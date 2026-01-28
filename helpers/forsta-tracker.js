const max_length = 2100;

async function getFingerprintData() {
    if (sessionStorage.getItem('fingerprint_id')) return;
    try {
        // Replace with your actual FingerprintJS script URL
        const FingerprintJS = await import('https://fpjscdn.net/v3/XXXX');
        const fp = await FingerprintJS.load();
        const { requestId } = await fp.get();
        sessionStorage.setItem('fingerprint_id', requestId);
    } catch (error) {
        console.error('Error getting fingerprint data:', error);
    }
}

function getClientDict() {
    const alias_dict = sessionStorage.getItem('client_dict') ? JSON.parse(sessionStorage.getItem('client_dict')) : {};
    const questions = alias_dict['questions'] || {}
    const responses = alias_dict['responses'] || {}
    const question_histories = alias_dict['question_histories'] || {}
    const start_times = alias_dict['start_times'] || {}
    return { questions, responses, question_histories, start_times }
}

function saveToForsta(questions, responses, question_histories) {

    const fingerprint_id = sessionStorage.getItem('fingerprint_id') || '';

    const alias_dict = {
        'questions': JSON.stringify(questions),
        'responses': JSON.stringify(responses),
        'question_histories': JSON.stringify(question_histories),
        'question_labels': Object.keys(questions),
        'fingerprint_id': fingerprint_id,
        'num_non_empty': Object.keys(responses).filter(key => responses[key] !== '').length,
        'fingerprint_id': fingerprint_id,
    }

    Survey.setPersistent("client_dict", alias_dict);
}

function saveToSessionStorage(questions, responses, question_histories, start_times) {
    const alias_dict = {
        'questions': questions,
        'responses': responses,
        'question_histories': question_histories,
        'start_times': start_times,
    }
    sessionStorage.setItem('client_dict', JSON.stringify(alias_dict));
}

function cleanHTMLString(htmlString) {
    return htmlString.replace(/<\/?[^>]+(>|$)/g, "");
}

function handleChange(event, origin, element, label, qn) {

    if (!element || element.closest('#question_' + label) === null) return;

    const { questions, responses, question_histories, start_times } = getClientDict();

    if (origin === 'input') {
        questions[label] = cleanHTMLString(qn.title);
        responses[label] = event.target.value;
    }

    if (!start_times[label]) {
        start_times[label] = Date.now();
        t = 0;
    } else {
        t = Date.now() - start_times[label];
    }

    const old_question_history = question_histories[label] || {};
    const new_question_history = JSON.parse(JSON.stringify(old_question_history));
    const new_item_history = { s: event.target.value }
    if (origin === 'copy') {
        new_item_history['o'] = 'c';
        new_item_history['ct'] = window.getSelection().toString();
    }
    new_question_history[t] = new_item_history;
    const new_history_length = JSON.stringify(new_question_history).length;
    const label_history = new_history_length > max_length ? old_question_history : new_question_history;
    question_histories[label] = label_history;

    saveToSessionStorage(questions, responses, question_histories, start_times);
    saveToForsta(questions, responses, question_histories);
}

function initializeClientDict(label, qn) {

    getFingerprintData();

    // Check if initializtion has already been done (using session storage)
    const initialized = sessionStorage.getItem('initialized') ? JSON.parse(sessionStorage.getItem('initialized')) : {}

    if (initialized[label]) return;

    const { questions, responses, question_histories, start_times } = getClientDict();

    // Initialize questions and responses to empty
    questions[label] = cleanHTMLString(qn.title);
    responses[label] = ''
    question_histories[label] = question_histories[label] || {}

    saveToSessionStorage(questions, responses, question_histories, start_times);
    saveToForsta(questions, responses, question_histories);

    // Set initialized to true
    initialized[label] = true;
    sessionStorage.setItem('initialized', JSON.stringify(initialized));
    addSubmitEventListener();
}

function addSubmitEventListener() {
    // Get all inputs and add the following event listener
    document.querySelectorAll('input[type="submit"]').forEach((button) => {
        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const { questions, responses, question_histories, start_times } = getClientDict();
            const final_responses = {}
            Object.keys(responses).forEach((key) => {
                const questionElement = document.getElementById('question_' + key);
                if (!questionElement) return;
                const inputOrTextArea = questionElement.querySelector('input, textarea');
                if (!inputOrTextArea) return;
                const response = inputOrTextArea.value;
                // Update the responses
                final_responses[key] = cleanHTMLString(response);
            });
            if (Object.keys(final_responses).length === 0) return;
            // If all values are the same as the initial values, return
            let all_same = true;
            Object.keys(final_responses).forEach((key) => {
                if (final_responses[key] !== responses[key]) all_same = false;
            });
            if (all_same) return;
            // Spread the final responses into the responses object
            const final_responses_object = { ...responses, ...final_responses };
            // Save the final responses to the client_dict
            saveToSessionStorage(questions, final_responses_object, question_histories, start_times);
            saveToForsta(questions, final_responses_object, question_histories);
        });
    });
}