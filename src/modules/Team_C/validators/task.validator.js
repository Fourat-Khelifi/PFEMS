import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const TaskSchema = Joi.object({
  title: Joi.string().min(3).max(200).required().messages({
    'string.min': 'Title must be at least 3 characters long',
    'string.max': 'Title cannot exceed 200 characters',
    'any.required': 'Title is required'
  }),
  description: Joi.string().allow('').max(2000).messages({
    'string.max': 'Description cannot exceed 2000 characters'
  }),
  status: Joi.string().valid("todo", "inprogress", "standby", "done").required().messages({
    'any.only': 'Status must be one of [todo, inprogress, standby, done]',
    'any.required': 'Status is required'
  }),
  priority: Joi.string().valid("low", "medium", "high").default("medium").messages({
    'any.only': 'Priority must be one of [low, medium, high]'
  }),
  userStoryId: Joi.string().pattern(objectIdPattern).required().messages({
    'string.pattern.base': 'User Story ID must be a valid ObjectId',
    'any.required': 'User Story ID is required'
  }),
  assignedTo: Joi.string().pattern(objectIdPattern).messages({
    'string.pattern.base': 'Assigned To must be a valid ObjectId'
  })
});

export const UpdateTaskSchema = Joi.object({
  title: Joi.string().min(3).max(200).messages({
    'string.min': 'Title must be at least 3 characters long',
    'string.max': 'Title cannot exceed 200 characters'
  }),
  description: Joi.string().allow('').max(2000).messages({
    'string.max': 'Description cannot exceed 2000 characters'
  }),
  status: Joi.string().valid("todo", "inprogress", "standby", "done").messages({
    'any.only': 'Status must be one of [todo, inprogress, standby, done]'
  }),
  priority: Joi.string().valid("low", "medium", "high").messages({
    'any.only': 'Priority must be one of [low, medium, high]'
  }),
  userStoryId: Joi.string().pattern(objectIdPattern).messages({
    'string.pattern.base': 'User Story ID must be a valid ObjectId'
  }),
  assignedTo: Joi.string().pattern(objectIdPattern).messages({
    'string.pattern.base': 'Assigned To must be a valid ObjectId'
  })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});
