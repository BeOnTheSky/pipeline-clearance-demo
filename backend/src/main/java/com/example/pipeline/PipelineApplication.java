package com.example.pipeline;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class PipelineApplication {

    /**
     * 启动应用，加载 Web 接口、MyBatis 映射和数据库连接配置。
     */
    public static void main(String[] args) {
        SpringApplication.run(PipelineApplication.class, args);
    }
}
