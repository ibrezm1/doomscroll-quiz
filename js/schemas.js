// ==========================================================================
// DeepScroll JSON Schemas (Structured Outputs for OpenRouter & AI APIs)
// ==========================================================================

window.DeepScrollSchemas = {
  // Schema for Curriculum Plan Generation
  planSchema: {
    name: "learning_curriculum_plan",
    strict: true,
    schema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        difficulty: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        modules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              title: { type: "string" },
              summary: { type: "string" },
              keyConcepts: {
                type: "array",
                items: { type: "string" }
              },
              targetQuestions: { type: "integer" }
            },
            required: ["id", "title", "summary", "keyConcepts", "targetQuestions"],
            additionalProperties: false
          }
        }
      },
      required: ["topic", "difficulty", "title", "summary", "modules"],
      additionalProperties: false
    }
  },

  // Schema for Topic Questions Batch Generation
  topicQuestionsSchema: {
    name: "topic_quiz_questions_batch",
    strict: true,
    schema: {
      type: "object",
      properties: {
        moduleTitle: { type: "string" },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              question: { type: "string" },
              codeSnippet: { type: "string" },
              options: {
                type: "array",
                items: { type: "string" }
              },
              correctAnswerIndex: { type: "integer" },
              explanation: { type: "string" },
              perplexityQuery: { type: "string" }
            },
            required: ["id", "question", "codeSnippet", "options", "correctAnswerIndex", "explanation", "perplexityQuery"],
            additionalProperties: false
          }
        }
      },
      required: ["moduleTitle", "questions"],
      additionalProperties: false
    }
  }
};
