$(function() {
    $("textarea").focus(function() {
        $(this).next(".placeholder").hide();
    })
    $("textarea").focusout(function() {
        if ($(this).val() == '') $(this).next(".placeholder").show();
    })
    $(".to-active").each(function() {
        var id = $(this).attr("id");
        $(this).next("#" + id).hide();
    })
    $(".to-active").click(function() {
        var id = $(this).attr("id");
        if ($(this).hasClass("activated")) {
            $(this).removeClass("activated")
            $(this).next("#" + id).hide(300);
        } else {
            $(this).addClass("activated");
            $(this).next("#" + id).show(300);
        }
    });
    $(document).on("click", ".sendTask", function(e) {
        e.preventDefault();
        var test = false;
        if ($("[name=test]").val() == "test") {
            test = true;
        };
        $.ajax({
            type: "post",
            data: {
                test,
                taskMessage: $("[name=taskMessage]").val(),
                attachment: $("[name=attachment]").val(),
                date: (Date.now()),
            }
        }).then(() => {
            $("#disputch").html("ГОТОВО");
        });
    })
})