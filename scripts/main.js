document.addEventListener("DOMContentLoaded", function () {
    const yamlInput = document.getElementById("yaml-input");
    const fileUpload = document.getElementById("file-upload");
    const validateButton = document.getElementById("validate-button");
    const fixErrorsButton = document.getElementById("fix-errors-button");
    const errorContainer = document.getElementById("error-container");
    const successContainer = document.getElementById("success-container");
    const loadingScreen = document.getElementById("loading-screen");
    const countdownElement = document.getElementById("countdown");

    let editor = CodeMirror.fromTextArea(yamlInput, {
        mode: "yaml",
        lineNumbers: true,
        theme: "default"
    });

    fileUpload.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        if (file.name.endsWith(".yaml") || file.name.endsWith(".yml") || file.name.endsWith(".txt")) {
            reader.onload = function (e) {
                editor.setValue(e.target.result); // Thay thế mã YAML cũ
            };
            reader.readAsText(file);
        } else if (file.name.endsWith(".zip")) {
            extractZip(file);
        }
    });

    function fixErrors() {
        let yamlContent = editor.getValue().trim();
        if (!yamlContent) {
            errorContainer.style.display = "block";
            errorContainer.innerHTML = "❌ Không có nội dung YAML để sửa.";
            return;
        }

        let lines = yamlContent.split("\n");
        let fixedLines = [];
        let hasFixes = false;
        let previousIndentation = 0;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let fixedLine = line;
            let currentIndentation = line.search(/\S/);

            // Kiểm tra dấu nháy mở nhưng không đóng
            let singleQuotes = (line.match(/'/g) || []).length;
            let doubleQuotes = (line.match(/"/g) || []).length;
            if (singleQuotes % 2 !== 0) {
                fixedLine += "'";
                hasFixes = true;
            }
            if (doubleQuotes % 2 !== 0) {
                fixedLine += '"';
                hasFixes = true;
            }



            // Nếu chứa '&', tự động thêm nháy đôi nếu chưa có
            if (fixedLine.includes("&") && !fixedLine.match(/^['"].*['"]$/)) {
                let parts = fixedLine.split(":");
                if (parts.length === 2) {
                    if (!parts[1].trim().startsWith('"') && !parts[1].trim().startsWith("'")) {
                        parts[1] = ` "${parts[1].trim()}"`;
                    }
                    fixedLine = parts.join(":");
                }
                hasFixes = true;
            }

            // Xử lý danh sách '-'
            if (line.trim().startsWith("-")) {
                let content = line.substring(line.indexOf("-") + 1).trim();
                if (content.includes("&") && !content.match(/^['"].*['"]$/)) {
                    content = `"${content}"`;
                    hasFixes = true;
                }
                fixedLine = "- " + content;

                // Kiểm tra xem dòng trước có kết thúc bằng ':' không, nhưng bỏ qua nếu dòng trước cũng là danh sách '-'
                if (i > 0 && !lines[i - 1].trim().startsWith("-") && !lines[i - 1].trim().endsWith(":")) {
                    fixedLines[fixedLines.length - 1] += ":";
                    hasFixes = true;
                }
            }

            fixedLines.push(fixedLine);
            previousIndentation = currentIndentation;
        }

        if (hasFixes) {
            editor.setValue(fixedLines.join("\n"));
            successContainer.style.display = "block";
            successContainer.innerHTML = "✅ YAML đã được sửa lỗi!";
            errorContainer.style.display = "none";
        } else {
            errorContainer.style.display = "block";
            errorContainer.innerHTML = "⚠ Không thể sửa lỗi tự động. Hãy kiểm tra cú pháp YAML.";
        }
    }

    fixErrorsButton.addEventListener("click", fixErrors);


    validateButton.addEventListener("click", function () {
        errorContainer.style.display = "none";
        successContainer.style.display = "none";
        loadingScreen.classList.remove("hidden");
        let countdown = 3;
        countdownElement.textContent = countdown;
        let countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            if (countdown === 0) {
                clearInterval(countdownInterval);
                loadingScreen.classList.add("hidden");
                validateYAML();
            }
        }, 1000);
    });

    function validateYAML() {
        let yamlContent = editor.getValue().trim();
        if (!yamlContent) {
            errorContainer.style.display = "block";
            errorContainer.innerHTML = "❌ Nội dung YAML không được để trống.";
            successContainer.style.display = "none";
            return;
        }

        try {
            let lines = yamlContent.split("\n");
            let errors = [];
            let errorLines = new Set();
            let previousLineWasList = false;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();

                // Kiểm tra dấu nháy mở nhưng không đóng
                let singleQuotes = (line.match(/'/g) || []).length;
                let doubleQuotes = (line.match(/"/g) || []).length;
                if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
                    errors.push(`Lỗi dòng ${i + 1}: Thiếu dấu nháy đóng.`);
                    errorLines.add(i);
                }

                // Kiểm tra danh sách '-'
                if (line.startsWith("-")) {
                    let content = line.substring(1).trim();
                    if (content.includes("&") && !content.match(/^['"].*['"]$/)) {
                        errors.push(`Lỗi dòng ${i + 1}: Giá trị chứa '&' phải được đặt trong dấu nháy đơn hoặc đôi.`);
                        errorLines.add(i);
                    }
                    if (i > 0 && !previousLineWasList && !lines[i - 1].trim().endsWith(":")) {
                        errors.push(`Lỗi dòng ${i + 1}: Dòng trước danh sách '-' phải kết thúc bằng ':'.`);
                        errorLines.add(i);
                    }
                    previousLineWasList = true;
                } else {
                    previousLineWasList = false;
                }
            }

            if (errors.length > 0) {
                errorContainer.style.display = "block";
                errorContainer.innerHTML = errors.join("<br>");
                successContainer.style.display = "none";
            } else {
                jsyaml.load(yamlContent);
                successContainer.style.display = "block";
                successContainer.innerHTML = "✅ YAML hợp lệ!";
                errorContainer.style.display = "none";
            }
        } catch (error) {
            errorContainer.style.display = "block";
            errorContainer.innerHTML = `❌ Lỗi YAML: ${error.message}`;
            successContainer.style.display = "none";
        }
    }

    editor.on("change", () => {
        validateYAML();
    });
});
