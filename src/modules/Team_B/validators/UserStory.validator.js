import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

// 🚀 CREATE USER STORY
export const createUserStorySchema = Joi.object({
  title: Joi.string().min(3).max(200).required().messages({
    'string.min': 'Title must be at least 3 characters long',
    'string.max': 'Title cannot exceed 200 characters',
    'any.required': 'Title is required'
  }),

  description: Joi.string().max(2000).allow('', null).messages({
    'string.max': 'Description cannot exceed 2000 characters'
  }),

  priority: Joi.string()
    .valid('highest', 'high', 'medium', 'low', 'lowest')
    .required()
    .messages({
      'any.only': 'Priority must be one of: highest, high, medium, low, lowest',
      'any.required': 'Priority is required'
    }),



  startDate: Joi.date().iso().required().messages({
    'date.format': 'Start date must be a valid ISO date',
    'any.required': 'Start date is required'
  }),

  endDate: Joi.date().iso().required().messages({
    'date.format': 'End date must be a valid ISO date',
    'any.required': 'End date is required'
  }),


  sprintId: Joi.string().pattern(objectIdPattern).required().messages({
    'string.pattern.base': 'Invalid sprint ID format',
    'any.required': 'Sprint ID is required'
  })
}).custom((value, helpers) => {
  if (new Date(value.endDate) <= new Date(value.startDate)) {
    return helpers.error('any.invalid', { message: 'End date must be after start date' });
  }
  return value;
}, 'Date validation');

// 🚀 UPDATE USER STORY
export const updateUserStorySchema = Joi.object({
  title: Joi.string().min(3).max(200).messages({
    'string.min': 'Title must be at least 3 characters long',
    'string.max': 'Title cannot exceed 200 characters'
  }),

  description: Joi.string().max(2000).allow('', null).messages({
    'string.max': 'Description cannot exceed 2000 characters'
  }),

  priority: Joi.string()
    .valid('highest', 'high', 'medium', 'low', 'lowest')
    .messages({
      'any.only': 'Priority must be one of: highest, high, medium, low, lowest'
    }),



  startDate: Joi.date().iso().messages({
    'date.format': 'Start date must be a valid ISO date'
  }),

  endDate: Joi.date().iso().messages({
    'date.format': 'End date must be a valid ISO date'
  }),

  sprintId: Joi.string().pattern(objectIdPattern).messages({
    'string.pattern.base': 'Invalid sprint ID format'})})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update'
  })
  .custom((value, helpers) => {
    if (value.startDate && value.endDate) {
      if (new Date(value.endDate) <= new Date(value.startDate)) {
        return helpers.error('any.invalid', { message: 'End date must be after start date' });
      }
    }
    return value;
});


// 🚀 USER STORY ID PARAM VALIDATION
export const userStoryIdParamSchema = Joi.object({
  userStoryId: Joi.string().pattern(objectIdPattern).required().messages({
    'string.pattern.base': 'Invalid user story ID format',
    'any.required': 'User story ID is required'
  })
});
