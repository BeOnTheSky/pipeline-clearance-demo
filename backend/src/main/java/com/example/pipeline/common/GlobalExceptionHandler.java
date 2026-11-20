package com.example.pipeline.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

/**
 * 将业务校验和请求异常转换为统一响应，保留对应的 HTTP 状态。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 返回 Service 中给出的校验提示和不存在管线等错误。 */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Result<Void>> handleBusinessException(ResponseStatusException exception) {
        int code = exception.getStatusCode().value();
        return ResponseEntity.status(code).body(Result.error(code, exception.getReason()));
    }

    /** 处理 JSON 格式错误和路径编号类型错误。 */
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Result<Void>> handleInvalidRequest(Exception exception) {
        return ResponseEntity.badRequest().body(Result.error(400, "请求参数格式不正确"));
    }

    /** 保留 Spring 的 404、405 等状态，其余异常记录日志并返回 500。 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleException(Exception exception) {
        if (exception instanceof ErrorResponse error) {
            int code = error.getStatusCode().value();
            return ResponseEntity.status(code).body(Result.error(code, error.getBody().getDetail()));
        }

        log.error("管线接口处理失败", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Result.error(500, "操作失败，请稍后重试"));
    }
}
