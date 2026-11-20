package com.example.pipeline.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 接口统一响应，data 保存本次请求的业务数据。
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Result<T> {

    /** 响应码，与 HTTP 状态一致。 */
    private int code;

    /** 操作结果或错误提示。 */
    private String message;

    /** 列表、管线信息等业务数据，无数据时省略。 */
    private T data;

    /** 返回查询、新增或修改成功的数据。 */
    public static <T> Result<T> success(T data) {
        return create(200, "成功", data);
    }

    /** 返回删除等无业务数据的成功结果。 */
    public static Result<Void> success() {
        return create(200, "成功", null);
    }

    /** 返回失败状态及具体提示。 */
    public static Result<Void> error(int code, String message) {
        return create(code, message, null);
    }

    /** 组装响应的通用字段。 */
    private static <T> Result<T> create(int code, String message, T data) {
        Result<T> result = new Result<>();
        result.setCode(code);
        result.setMessage(message);
        result.setData(data);
        return result;
    }
}
