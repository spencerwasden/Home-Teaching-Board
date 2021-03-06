﻿
function getDistricts(callback) {
    "use strict";
    var code = function () {
        //We have access to topframe - no longer a contentscript          
        var scopeDistricts = $('[ng-controller="HeaderCtrl"]').scope().districts;

        var assignedTeacherIDs = [];
        var assignedHouseholdIDs = [];
        var districts = scopeDistricts.map(function (district) {
            return {
                name: district.name,
                id: district.id,
                districtLeader: /*chance.name({ gender: "male" }),//*/ (district.districtLeader ? district.districtLeader.formattedName : ""),
                companionships: district.companionships.map(function (comp) {
                    return {
                        assignments: comp.assignments.map(function (assignment) {
                            assignedHouseholdIDs.push(assignment.individualId);
                            return {
                                name: /*chance.name({ gender: "male" }),//*/ assignment.individual.formattedName,
                                id: assignment.individualId
                            }
                        }),
                        teachers: comp.teachers.map(function (teacher) {
                            assignedTeacherIDs.push(teacher.individualId);
                            return {
                                name: /*chance.name({ gender: "male" }),//*/teacher.individual.formattedName,
                                id: teacher.individualId
                            }
                        })
                    };
                })
            };
        });

        localStorage.setItem("districts", JSON.stringify(districts));

        var overViewScope = $('.accordion').scope();
        var unassignedTeachers = [];
        $.each(overViewScope.potentialTeachers, function (i, teacher) {
            if (assignedTeacherIDs.indexOf(teacher.individualId) < 0 &&
                teacher.teacherAuxIds.htAuxiliaries.length == 0) {
                //debugger
                unassignedTeachers.push({
                    name: /*chance.name({ gender: "male" }),//*/teacher.formattedName,
                    id: teacher.individualId
                });
            }
        });
        localStorage.setItem("unassignedTeachers", JSON.stringify(unassignedTeachers));


        var unassignedHouseholds = [];
        $.each(overViewScope.potentialAssignments, function (i, assignment) {
            if (assignedHouseholdIDs.indexOf(assignment.individualId) < 0 &&
                !assignment.family.isAssignedHT) {
                unassignedHouseholds.push({
                    name: /*chance.name({ gender: "male" }),//*/ assignment.formattedName,
                    id: assignment.individualId
                });
            }
        });
        localStorage.setItem("unassignedHouseholds", JSON.stringify(unassignedHouseholds));
    };
    var script = document.createElement('script');
    script.textContent = '(' + code + ')()';
    (document.head || document.documentElement).appendChild(script);
    script.parentNode.removeChild(script);
    callback();
}

var interval = setInterval(function () {
    var districtEditBtn = $('#district-edit-btn');
    if (districtEditBtn.length > 0) {
        districtEditBtn.after('<a class="btn pull-right" id="ViewAsBoard">View as Board</a>');
        $('#ViewAsBoard').on('click', viewAsBoardClicked);
        clearInterval(interval);
    }
}, 500);

//$('h2.pageTitle a').after('<a class="btn" id="ViewAsBoard">View as Board</a>');

var homeTeachingBoardApp = angular.module('HomeTeachingBoardApp', []);

homeTeachingBoardApp.controller('HomeTeachingBoardController', function HomeTeachingBoardController($scope) {

    getDistricts(function () {
        $scope.districts = JSON.parse(localStorage.getItem("districts"));
        $scope.unassignedHouseholds = JSON.parse(localStorage.getItem("unassignedHouseholds"));
        $scope.unassignedTeachers = JSON.parse(localStorage.getItem("unassignedTeachers"));

        $scope.save = function () {
            if (localStorage.getItem('savedDistricts')) {
                var sure = confirm('This will overwrite your previously saved board. Are you sure you want to continue?');
                if (sure) {
                    saveBoard();
                }
            }
            else {
                saveBoard();
            }

        }

        function saveBoard() {
            var stringed = JSON.stringify($scope.districts);
            localStorage.setItem("savedDistricts", stringed);
            alert('Board saved!');
        }

        $scope.load = function () {
            $scope.districts = JSON.parse(localStorage.getItem('savedDistricts'));
        }

        //(optional cleanup):
        localStorage.removeItem("districts");
        localStorage.removeItem("unassignedTeachers");
        localStorage.removeItem("unassignedHouseholds");
    });
});


var boardLoaded = false;
function viewAsBoardClicked() {

    $('html').addClass('view-as-board');

    if (boardLoaded) {
        return;
    }
    boardLoaded = true;

    $('body').append('<div id="BoardWrapper"></div>');
    var htbFileUrl = chrome.extension.getURL("html/HomeTeachingBoard.html");
    $('#BoardWrapper').load(htbFileUrl, function () {
        angular.bootstrap($('#BoardWrapper')[0], ['HomeTeachingBoardApp']);

        function setUpDraggables() {
            $('[draggable]:not(.ui-draggable)').draggable({
                revert: "invalid",
                zIndex: 1000000
            });
        }
        setUpDraggables();

        function setupDroppables() {

            $('[droppable]:not(.ui-droppable)').droppable({
                accept: function (draggable) {
                    return $(this).attr('droppable').indexOf(draggable.attr('draggable')) >= 0 && draggable.closest(this).length == 0;
                },
                hoverClass: "drop-hover",
                drop: function (event, ui) {
                    var dragScope = ui.draggable.scope();
                    var dropScope = $(this).scope();
                    var dropElement = $(this);

                    var sourceList;
                    var destinationList;
                    var item;
                    var companionship;

                    //If we are dropping onto a companionship we have to check if that companionship already exists or if they are creating a new one.
                    if (dropElement.hasClass('htb-companionship')) {
                        companionship = dropScope.companionship;
                        if (!companionship) {
                            companionship = { teachers: [], assignments: [] };
                            dropScope.district.companionships.push(companionship);
                        }
                    }


                    if (dragScope.teacher) {
                        sourceList = dragScope.companionship.teachers;
                        destinationList = companionship ? companionship.teachers : dropScope.unassignedTeachers;
                        item = dragScope.teacher;
                    }
                    else if (dragScope.assignment) {
                        sourceList = dragScope.companionship.assignments;
                        destinationList = companionship ? companionship.assignments : dropScope.unassignedHouseholds;
                        item = dragScope.assignment;
                    }
                    else if (dragScope.companionship) {
                        sourceList = dragScope.district.companionships;
                        destinationList = dropScope.district.companionships;
                        item = dragScope.companionship;
                    }
                    else if (dragScope.unassignedHousehold) {
                        sourceList = dragScope.$parent.unassignedHouseholds;
                        destinationList = dropScope.companionship.assignments;
                        item = dragScope.unassignedHousehold;
                    }
                    else if (dragScope.unassignedTeacher) {
                        sourceList = dragScope.$parent.unassignedTeachers;
                        destinationList = dropScope.companionship.teachers;
                        item = dragScope.unassignedTeacher;
                    }

                    destinationList.push(item);
                    sourceList.splice(dragScope.$index, 1);

                    if (dragScope.companionship &&
                        dragScope.companionship.teachers.length == 0 &&
                        dragScope.companionship.assignments.length == 0) {
                        dragScope.district.companionships.splice(dragScope.$parent.$index, 1);
                    }

                    dropScope.$apply();

                    setUpDraggables();
                    setupDroppables();

                }
            });

            $('[draggable]').mouseenter(function () {
                $('.hover').removeClass('hover');
                $(this).addClass('hover');
            }).mouseleave(function () {
                $(this).removeClass('hover');
            });
        }
        setupDroppables();

        $('#CloseButton').on('click', function () {
            $('html').removeClass('view-as-board');
        });

        $('#HTBSaveModal').on('show.bs.modal', function (event) {
            var button = $(event.relatedTarget) // Button that triggered the modal
            var recipient = button.data('whatever') // Extract info from data-* attributes
            // If necessary, you could initiate an AJAX request here (and then do the updating in a callback).
            // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.
            var modal = $(this)
            modal.find('.modal-title').text('New message to ' + recipient)
            modal.find('.modal-body input').val(recipient)
        });
    });
}


