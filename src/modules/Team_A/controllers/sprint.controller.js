import * as sprintService from "../services/sprint.service.js";
import { StatusCodes } from "http-status-codes";

export const createSprint = async (req, res, next) => {
  try {
    const sprintData = req.validatedBody;
    const studentId = req.student.id;

    const result = await sprintService.createSprint(sprintData, studentId);

    res.status(StatusCodes.CREATED).json({
      success: result.success,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

export const updateSprint = async (req, res, next) => {
  try {
    const { sprintId } = req.params;
    const updateData = req.validatedBody;
    const studentId = req.student.id;

    const result = await sprintService.updateSprint(sprintId, updateData, studentId);

    res.status(StatusCodes.OK).json({
      success: result.success,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSprint = async (req, res, next) => {
  try {
    const { sprintId } = req.params;
    const studentId = req.student.id;

    const result = await sprintService.deleteSprint(sprintId, studentId);

    res.status(StatusCodes.OK).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

export const reorderSprints = async (req, res, next) => {
  try {
    const { sprints } = req.validatedBody; // Expecting { sprints: [{ sprintId, orderIndex }] }
    const studentId = req.student.id;

    const result = await sprintService.reorderSprints(sprints, studentId);

    res.status(StatusCodes.OK).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};
export const listSprints = async (req, res, next) => {
  try {
    const projectId = req.student.project;
    const result = await sprintService.listSprints(projectId);

    res.status(StatusCodes.OK).json({
      success: result.success,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};
